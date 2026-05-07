// =============================================================================
// AI Code Review Agent — Core Types
// =============================================================================

/** A reference to a context object, parsed from @-syntax in raw messages */
export type ContextReference =
  | { type: "file"; path: string }
  | { type: "commit"; hash: string }
  | { type: "link"; url: string } // link to our app e.g. https://dyff.sh/comments/1234567890
  | { type: "system_prompt"; name: string };

/** The parsed form of a raw message — text interleaved with references */
export interface ParsedSegment {
  kind: "text" | "reference";
  value: string; // plain text, or the raw reference string e.g. "@src/lib/auth.ts"
  ref?: ContextReference; // only present when kind === "reference"
}

/** Content block for LLM APIs (mirrors Anthropic/OpenAI structured format) */
export type LLMContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string }
  | { type: "thinking"; thinking: string }
  | { type: "redacted_thinking"; data: string }
  | { type: "passthrough"; original: Record<string, unknown> };

export interface TokenUsageSnapshot {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** The most recent input token count — approximates the current context window size */
  contextTokens?: number;
}

/**
 * Metadata sidecar — state that should NOT be sent to the LLM.
 * This is the mechanism for outdated flags, cancellation markers,
 * posted-comment status, etc.
 */
export interface MessageMetadata {
  /** When references become stale (e.g. new commits pushed) */
  stale?: boolean;
  /** If the user or system cancelled mid-generation */
  cancelled?: boolean;
  /** For suggest_comment tool calls — tracks if the comment was posted */
  commentPosted?: boolean;
  generatedAt?: string;
  usage?: TokenUsageSnapshot;
  cumulativeUsage?: TokenUsageSnapshot;
  retryCount?: number;
  commitHash?: string; // The commit hash that the message is based on
}

/** A single message in the conversation, as persisted in the database */
export interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "tool_result";
  /** The raw message as typed/generated — contains @references */
  raw: string;
  /** The enriched content blocks ready for LLM consumption */
  enriched: LLMContentBlock[];
  /** State that never sent to LLM */
  metadata: MessageMetadata;
}

// ---------------------------------------------------------------------------
// LLM CLIENT
// ---------------------------------------------------------------------------

/** An LLM-ready message (what actually gets sent to the API) */
export interface LLMMessage {
  role: "user" | "assistant" | "tool_result";
  content: LLMContentBlock[];
}

/** Streaming events emitted by the LLM client */
export type LLMStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "tool_use_start"; id: string; name: string }
  | { type: "tool_use_delta"; id: string; inputJson: string }
  | { type: "tool_use_end"; id: string; input: Record<string, unknown> }
  | { type: "passthrough_block"; block: Record<string, unknown> }
  | { type: "message_end"; usage: { inputTokens: number; outputTokens: number } }
  | { type: "error"; error: Error };

// ---------------------------------------------------------------------------
// TOOL DEFINITIONS
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
}

export interface ToolResult {
  /** Raw output from the tool — may contain @references itself */
  output: string;
  /** Whether the tool wants to signal an error to the LLM */
  isError?: boolean;
}

// ---------------------------------------------------------------------------
// APP EVENTS
// ---------------------------------------------------------------------------

/** Application-level events sent to the frontend */
export type AppEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; toolName: string; toolCallId: string, input: Record<string, unknown> }
  | { type: "tool_call_end"; toolCallId: string; result: string }
  | { type: "tool_call_error"; toolCallId: string; error: string; willRetry: boolean }
  | { type: "usage_update"; turn: TokenUsageSnapshot; cumulative: TokenUsageSnapshot }
  | { type: "message_complete"; messageId: string }
  | { type: "error"; code: string; message: string }
  | { type: "cancelled" };

// ---------------------------------------------------------------------------
// SESSION & CONFIG
// ---------------------------------------------------------------------------

// The main interface that wires all the pieces together
// IF update type, need to update the frontend as well
export interface ChatSession {
  id: string;
  agentName: string;
  messages: StoredMessage[];
  // TODO: remove this status
  status: "idle" | "running" | "cancelled" | "error" | "completed" | "max_tokens_exceeded" | "max_turns_exceeded";
  /** Cumulative token usage across the entire session (all run() calls) */
  totalUsage: TokenUsageSnapshot;
  createdAt: string;
  updatedAt: string;
  commitHash: string;
  systemPrompt: string;
}

export interface AgentConfig {
  maxTurns: number; // safety limit on tool-call loops
  maxTokens: number; // total token budget for the session
  maxRetries: number; // max retries for LLM calls and tool calls (default: 2)
}
