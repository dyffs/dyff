import type User from "@/database/user";
import type { LLMClient } from "../llms/llm_client";
import type { ToolHandler } from "../tools/tool_registry";
import type { ContextPruner } from "../context_pruner/context_pruner";
import type { AgentConfig, ChatSession, StoredMessage, TokenUsageSnapshot } from "../ai_agent/types";

export interface BuildAgentOptions {
  name: string;
  systemPrompt?: string;
  promptFile?: string;
  tools?: ToolHandler[];
  maxTurns?: number;
  maxTokens?: number;
  maxRetries?: number;
  user: User;
  repositoryId: string;
  commitHash: string;
  llmClientFactory: () => LLMClient | Promise<LLMClient>;
  pullRequestId: string;
  githubPrNumber: number;
  contextPruner?: ContextPruner;
  reviewedFilesLoader?: (sessionId: string) => Promise<string[]>;
}

export interface AgentBlueprint {
  name: string;
  systemPrompt: string;
  tools: ToolHandler[];
  config: AgentConfig;
  user: User;
  repositoryId: string;
  commitHash: string;
  llmClientFactory: () => LLMClient | Promise<LLMClient>;
  pullRequestId: string;
  githubPrNumber: number;
  contextPruner?: ContextPruner;
  reviewedFilesLoader?: (sessionId: string) => Promise<string[]>;
}

export interface AgentResult {
  output: string;
  sessionId: string;
  messages: StoredMessage[];
  usage: TokenUsageSnapshot;
  status: ChatSession["status"];
}