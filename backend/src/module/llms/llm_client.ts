import { LLMStreamEvent, LLMMessage, ToolDefinition } from "../ai_agent/types";

/**
 * LLM Client interface for streaming responses from language models.
 * Supports multiple providers (Anthropic, OpenAI, etc.)
 */
export interface LLMClient {
  stream(params: {
    system: string;
    messages: LLMMessage[];
    tools: ToolDefinition[];
  }): AsyncIterable<LLMStreamEvent>;

  /** Abort the current stream (for cancellation) */
  abort(): void;
}
