// =============================================================================
// Agent Loop — The orchestrator
// =============================================================================

import { MessagePipeline } from "../message_processor/message_pipeline";
import { LLMClient } from "../llms/llm_client";
import { ToolRegistry } from "../tools/tool_registry";
import { SessionStore } from "./session_store";
import { TokenUsageTracker } from "./token_tracker";
import { withRetry, generateId } from "./utils";
import User from "@/database/user";
import {
  AgentConfig,
  AppEvent,
  ChatSession,
  LLMContentBlock,
  LLMMessage,
  StoredMessage,
  TokenUsageSnapshot,
  ToolResult,
  ParsedSegment,
} from "./types";
import { ContextPruner } from "../context_pruner/context_pruner";
import { logger } from '@/service/logger'

import { agentDebug } from "./debug_logger";

// ---------------------------------------------------------------------------
// Internal types for extracted methods
// ---------------------------------------------------------------------------

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface LLMTurnResult {
  signal: "success" | "cancelled" | "error";
  blocks: LLMContentBlock[];
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number } | null;
  retryCount: number;
}

/**
 * AgentLoop orchestrates the agentic conversation flow:
 * 1. Receives user message
 * 2. Calls LLM
 * 3. Executes any tool calls
 * 4. Loops until completion or limits reached
 *
 * Handles streaming, retries, cancellation, and token budgets.
 */
export class AgentLoop {
  private cancelled = false;
  private currentLLMClient: LLMClient | null = null;

  constructor(
    private pipeline: MessagePipeline,
    private llmClientFactory: () => LLMClient | Promise<LLMClient>,
    private tools: ToolRegistry,
    private store: SessionStore,
    private config: AgentConfig,
    private currentUser: User,
    private contextPruner: ContextPruner = new ContextPruner([]),
    private reviewedFilesLoader?: (sessionId: string) => Promise<string[]>,
  ) {}

  /**
   * Run the agent for one user message.
   * Yields AppEvents that should be streamed to the frontend.
   */
  async *run(sessionId: string, userRawMessage: string): AsyncGenerator<AppEvent> {
    let session = await this.store.load(sessionId);
    await this.store.updateStatus(sessionId, "running");
    agentDebug.sessionStatus("running");

    const usageTracker = new TokenUsageTracker(session.totalUsage);

    session = await this.ingestUserMessage(session, userRawMessage);

    for (let turn = 0; turn < this.config.maxTurns; turn++) {
      agentDebug.turnStart(turn, sessionId);

      // -- Guard: cancellation --
      if (this.cancelled) {
        agentDebug.cancelled();
        yield { type: "cancelled" };
        await this.store.updateStatus(sessionId, "cancelled");
        return;
      }

      // -- Guard: token budget --
      if (usageTracker.exceeds(this.config.maxTokens)) {
        agentDebug.tokenBudget(usageTracker.snapshot.totalTokens, this.config.maxTokens);
        yield {
          type: "error",
          code: "token_budget_exceeded",
          message: `Token budget exceeded: ${usageTracker.snapshot.totalTokens} / ${this.config.maxTokens}`,
        };
        await this.store.updateStatus(sessionId, "max_tokens_exceeded");
        return;
      }

      // -- Prune context (remove reviewed file content, etc.) --
      const prunedMessages = await this.pruneContext(session, usageTracker);

      // -- Stream LLM response (with retries) --
      const llmMessages = this.buildLLMMessages({ ...session, messages: prunedMessages });
      const turnResult: LLMTurnResult = yield* this.streamLLMTurn(sessionId, session, llmMessages);

      if (turnResult.signal === "cancelled") {
        await this.store.updateStatus(sessionId, "cancelled");
        return;
      };
      if (turnResult.signal === "error") {
        await this.store.updateStatus(sessionId, "error");
        return;
      };

      // -- Track & emit token usage --
      if (turnResult.usage) usageTracker.add(turnResult.usage);
      const turnSnapshot = toUsageSnapshot(turnResult.usage);

      yield {
        type: "usage_update",
        turn: turnSnapshot,
        cumulative: usageTracker.snapshot,
      };

      // -- Persist assistant message --
      const { message: assistantMessage, session: updatedSession } = await this.persistAssistantMessage(
        session, turnResult, turnSnapshot, usageTracker.snapshot
      );
      session = updatedSession;

      // -- No tool calls → conversation turn complete --
      if (turnResult.toolCalls.length === 0) {
        yield { type: "message_complete", messageId: assistantMessage.id };
        await this.store.updateStatus(sessionId, "completed");
        return;
      }

      // -- Execute tool calls, feed results back for next turn --
      const { session: toolUpdateSession, result: toolsCancelled }: { session: ChatSession, result: boolean } = yield* this.executeToolCalls(
        sessionId, session, turnResult.toolCalls
      );
      session = toolUpdateSession;
      
      if (toolsCancelled) {
        await this.store.updateStatus(sessionId, "cancelled");
        return;
      }
    }

    // Safety: max turns exceeded
    agentDebug.maxTurnsExceeded();
    yield {
      type: "error",
      code: "max_turns_exceeded",
      message: "Agent reached maximum turn limit",
    };
    await this.store.updateStatus(sessionId, "max_turns_exceeded");
  }

  /** Request cancellation — takes effect at next checkpoint */
  cancel() {
    this.cancelled = true;
    this.currentLLMClient?.abort();
  }

  private async pruneContext(session: ChatSession, usageTracker: TokenUsageTracker): Promise<StoredMessage[]> {
    const reviewedFiles = await this.loadReviewedFiles(session.id);
    const prunedMessages = this.contextPruner.prune({
      messages: session.messages,
      reviewedFiles,
      contextTokens: usageTracker.contextTokens,
    });

    return prunedMessages;
  }

  /** Parse, enrich, and persist the incoming user message. */
  private async ingestUserMessage(
    session: ChatSession,
    rawMessage: string
  ): Promise<ChatSession> {
    agentDebug.userMessage(rawMessage);
    const enriched: LLMContentBlock[] = [{
      type: "text",
      text: rawMessage,
    }];

    const userMessage: StoredMessage = {
      id: generateId(),
      role: "user",
      raw: rawMessage,
      enriched,
      metadata: {
        generatedAt: new Date().toISOString(),
        commitHash: session.commitHash,
      },
    };
    return this.store.appendMessage(session.id, userMessage);
  }

  /**
   * Stream one LLM turn with retry logic.
   * Yields AppEvents as they arrive and returns the accumulated result.
   *
   * Uses `yield*` delegation — the caller's generator yields events transparently.
   */
  private async *streamLLMTurn(
    sessionId: string,
    session: ChatSession,
    llmMessages: LLMMessage[]
  ): AsyncGenerator<AppEvent, LLMTurnResult> {
    const blocks: LLMContentBlock[] = [];
    const toolCalls: ToolCall[] = [];
    // Track tool names from start events (tool_use_end doesn't include the name)
    const activeToolNames = new Map<string, string>();
    let usage: { inputTokens: number; outputTokens: number } | null = null;
    let retryCount = 0;

    agentDebug.llmRequest(llmMessages.length, this.tools.getDefinitions().length);

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      // Reset accumulators on each attempt
      blocks.length = 0;
      toolCalls.length = 0;
      activeToolNames.clear();
      usage = null;
      let streamSucceeded = false;

      const client = await this.llmClientFactory();
      this.currentLLMClient = client;

      try {
        for await (const event of client.stream({
          system: session.systemPrompt,
          messages: llmMessages,
          tools: this.tools.getDefinitions(),
        })) {
          if (this.cancelled) {
            agentDebug.cancelled();
            client.abort();
            yield { type: "cancelled" };
            await this.store.updateStatus(sessionId, "cancelled");
            return { signal: "cancelled", blocks, toolCalls, usage, retryCount };
          }

          switch (event.type) {
            case "text_delta":
              yield { type: "text_delta", text: event.text };
              this.accumulateTextBlock(blocks, event.text);
              break;

            case "thinking_delta":
              this.accumulateThinkingBlock(blocks, event.text);
              break;

            case "tool_use_start":
              activeToolNames.set(event.id, event.name);
              agentDebug.llmEvent("tool_use_start", `tool=${event.name} id=${event.id}`);
              break;

            case "tool_use_end": {
              const name = activeToolNames.get(event.id) ?? "unknown";
              agentDebug.llmEvent("tool_use_end", `tool=${name} input=${JSON.stringify(event.input).slice(0, 150)}`);
              toolCalls.push({ id: event.id, name, input: event.input });

              // Emit here instead of tool_use_start to get the input
              yield { type: "tool_call_start", toolName: name, toolCallId: event.id, input: event.input };
              blocks.push({ type: "tool_use", id: event.id, name, input: event.input });
              break;
            }

            case "passthrough_block": {
              const raw = event.block;
              if (raw.type === "redacted_thinking") {
                blocks.push({ type: "redacted_thinking", data: raw.data as string });
              } else {
                blocks.push({ type: "passthrough", original: raw });
              }
              break;
            }

            case "message_end":
              usage = event.usage;
              agentDebug.llmComplete(usage);
              break;

            case "error":
              throw event.error;
          }
        }
        streamSucceeded = true;
      } catch (err) {
        logger.error('LLM call failed:', err);
        this.currentLLMClient = null;

        if (attempt < this.config.maxRetries) {
          retryCount = attempt + 1;
          agentDebug.llmRetry(attempt + 1, this.config.maxRetries + 1, err);
          yield {
            type: "error",
            code: "llm_retry",
            message: `LLM call failed (attempt ${attempt + 1}/${this.config.maxRetries + 1}), retrying...`,
          };
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }

        agentDebug.error("llm_error", `LLM call failed after ${this.config.maxRetries + 1} attempts: ${err}`);
        yield {
          type: "error",
          code: "llm_error",
          message: `LLM call failed after ${this.config.maxRetries + 1} attempts: ${err}`,
        };
        await this.store.updateStatus(sessionId, "error");
        return { signal: "error", blocks, toolCalls, usage, retryCount };
      } finally {
        this.currentLLMClient = null;
      }

      if (streamSucceeded) break;
    }

    return { signal: "success", blocks, toolCalls, usage, retryCount };
  }

  /**
   * Execute pending tool calls, persist results, and yield progress events.
   * Returns true if cancelled during execution.
   */
  private async *executeToolCalls(
    sessionId: string,
    session: ChatSession,
    toolCalls: ToolCall[]
  ): AsyncGenerator<AppEvent, { session: ChatSession, result: boolean }> {
    let ongoingSession = session;

    for (const toolCall of toolCalls) {
      if (this.cancelled) {
        agentDebug.cancelled();
        yield { type: "cancelled" };
        await this.store.updateStatus(sessionId, "cancelled");
        return { session: ongoingSession, result: true };
      }

      agentDebug.toolExecStart(toolCall.name, JSON.stringify(toolCall.input));
      const result = await this.executeOneToolCall(toolCall, ongoingSession);
      agentDebug.toolExecEnd(toolCall.name, result.output);

      if (result.error) {
        agentDebug.error("tool_error", `${toolCall.name}: ${result.error}`);
        yield {
          type: "tool_call_error",
          toolCallId: toolCall.id,
          error: result.error,
          willRetry: false,
        };
      }

      yield {
        type: "tool_call_end",
        toolCallId: toolCall.id,
        result: result.output,
      };

      const updatedSession = await this.persistToolResult(sessionId, ongoingSession, toolCall.id, result);
      ongoingSession = updatedSession;
    }

    return { session: ongoingSession, result: false };
  }

  /** Execute a single tool call with retries. */
  private async executeOneToolCall(
    toolCall: ToolCall,
    session: ChatSession
  ): Promise<ToolResult & { error?: string }> {
    try {
      return await withRetry(
        () => this.tools.execute(toolCall.name, toolCall.input, session, this.currentUser),
        this.config.maxRetries,
        `tool:${toolCall.name}`
      );
    } catch (err) {
      return {
        output: `Error executing tool "${toolCall.name}" after ${this.config.maxRetries + 1} attempts: ${err}`,
        isError: true,
        error: String(err),
      };
    }
  }

  /** Enrich and persist a tool result message. */
  private async persistToolResult(
    sessionId: string,
    session: ChatSession,
    toolCallId: string,
    result: ToolResult
  ): Promise<ChatSession> {

    // Skip parsing and enriching for tool results for now
    // const parsed = this.pipeline.parse(result.output);
    // const enriched = await this.pipeline.enrich(parsed, session);

    // Simply wrap the result as a parsed text segment
    const parsed: ParsedSegment[] = [{
      kind: "text",
      value: result.output,
    }];

    const message: StoredMessage = {
      id: generateId(),
      role: "tool_result",
      raw: result.output,
      enriched: [
        {
          type: "tool_result",
          tool_use_id: toolCallId,
          content: result.output,
        },
      ],
      metadata: {
        generatedAt: new Date().toISOString(),
        commitHash: session.commitHash,
      },
    };
    return await this.store.appendMessage(sessionId, message);
  }

  /** Persist the assistant's response with usage metadata. */
  private async persistAssistantMessage(
    session: ChatSession,
    turnResult: LLMTurnResult,
    turnSnapshot: TokenUsageSnapshot,
    cumulativeSnapshot: TokenUsageSnapshot
  ): Promise<{ message: StoredMessage, session: ChatSession }> {
    const message: StoredMessage = {
      id: generateId(),
      role: "assistant",
      raw: this.reconstructRawFromBlocks(turnResult.blocks),
      enriched: turnResult.blocks,
      metadata: {
        generatedAt: new Date().toISOString(),
        usage: turnSnapshot,
        cumulativeUsage: cumulativeSnapshot,
        retryCount: turnResult.retryCount,
        commitHash: session.commitHash,
      },
    };

    const updatedSession = await this.store.appendMessage(session.id, message);
    return { message, session: updatedSession };
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /** Load reviewed file paths from the chat session's agent review notes. */
  private async loadReviewedFiles(sessionId: string): Promise<string[]> {
    if (this.reviewedFilesLoader) {
      return this.reviewedFilesLoader(sessionId);
    }
    return [];
  }

  private buildLLMMessages(session: ChatSession): LLMMessage[] {
    return session.messages
      .filter((m) => !m.metadata.cancelled)
      .map((m) => ({
        role: m.role,
        content: m.enriched,
      }));
  }

  /** Append text to the last text block, or push a new one. */
  private accumulateTextBlock(blocks: LLMContentBlock[], text: string): void {
    const last = blocks[blocks.length - 1];
    if (last?.type === "text") {
      last.text += text;
    } else {
      blocks.push({ type: "text", text });
    }
  }

  /** Append thinking text to the last thinking block, or push a new one. */
  private accumulateThinkingBlock(blocks: LLMContentBlock[], text: string): void {
    const last = blocks[blocks.length - 1];
    if (last?.type === "thinking") {
      last.thinking += text;
    } else {
      blocks.push({ type: "thinking", thinking: text });
    }
  }

  private reconstructRawFromBlocks(blocks: LLMContentBlock[]): string {
    return blocks
      .map((b) => {
        if (b.type === "text") return b.text;
        if (b.type === "tool_use") return `[tool_call: ${b.name}]`;
        if (b.type === "thinking") return `[thinking]`;
        if (b.type === "redacted_thinking") return `[redacted_thinking]`;
        return "";
      })
      .join("");
  }
}

// ===========================================================================
// Pure helpers
// ===========================================================================

function toUsageSnapshot(
  usage: { inputTokens: number; outputTokens: number } | null
): TokenUsageSnapshot {
  if (!usage) return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.inputTokens + usage.outputTokens,
  };
}
