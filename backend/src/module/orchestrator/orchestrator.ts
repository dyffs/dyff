import { AgentLoop } from "../ai_agent/agent_loop";
import { PgSessionStore } from "../ai_agent/pg_session_store";
import { ContextResolverRegistry } from "../message_processor/context_resolver";
import { MessagePipeline } from "../message_processor/message_pipeline";
import { ToolRegistry } from "../tools/tool_registry";
import { readSystemPrompt } from "./factory";

import type {
  StoredMessage,
} from "../ai_agent/types";
import type { AgentBlueprint, AgentResult, BuildAgentOptions } from "./types";

/**
 * Build an agent blueprint — an opaque config object, not yet running.
 */
export function buildAgentBlueprint(options: BuildAgentOptions): AgentBlueprint {
  // Resolve system prompt
  let systemPrompt: string;
  if (options.systemPrompt) {
    systemPrompt = options.systemPrompt;
  } else if (options.promptFile) {
    systemPrompt = readSystemPrompt(options.promptFile);
  } else {
    throw new Error("buildAgent requires either systemPrompt or promptFile");
  }

  return {
    name: options.name,
    systemPrompt,
    tools: options.tools ?? [],
    config: {
      maxTurns: options.maxTurns ?? 50,
      maxTokens: options.maxTokens ?? 500_000,
      maxRetries: options.maxRetries ?? 2,
    },
    user: options.user,
    repositoryId: options.repositoryId,
    commitHash: options.commitHash ?? "",
    llmClientFactory: options.llmClientFactory,
    pullRequestId: options.pullRequestId,
    githubPrNumber: options.githubPrNumber,
    contextPruner: options.contextPruner,
    reviewedFilesLoader: options.reviewedFilesLoader,
  };
}

function buildRuntimeFromBlueprint(blueprint: AgentBlueprint) {
  const store = new PgSessionStore();
  const resolver = new ContextResolverRegistry(
    blueprint.user,
    blueprint.repositoryId ?? "",
  );
  const pipeline = new MessagePipeline(resolver);

  const toolRegistry = new ToolRegistry();
  for (const tool of blueprint.tools) {
    toolRegistry.register(tool);
  }

  return {
    agent: new AgentLoop(
      pipeline,
      blueprint.llmClientFactory,
      toolRegistry,
      store,
      blueprint.config,
      blueprint.user,
      blueprint.contextPruner,
      blueprint.reviewedFilesLoader,
    ),
    store,
  };
}

export async function runAgentTurnAndWait(
  blueprint: AgentBlueprint,
  sessionId: string,
  inputMessage: string,
): Promise<AgentResult> {

  const runtime = buildRuntimeFromBlueprint(blueprint);

  const events = runtime.agent.run(sessionId, inputMessage);
  for await (const event of events) {
    // simply consume the events
  }

  const finalSession = await runtime.store.load(sessionId);
  const messages = finalSession.messages;
  const output = extractLastAssistantText(messages);

  return {
    output,
    sessionId,
    status: finalSession.status,
    messages,
    usage: finalSession.totalUsage,
  };
}

function extractLastAssistantText(messages: StoredMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      // Extract text blocks from enriched content
      const textParts = msg.enriched
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text);
      if (textParts.length > 0) return textParts.join("");
    }
  }
  return "";
}
