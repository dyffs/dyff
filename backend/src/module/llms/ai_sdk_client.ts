import {
  jsonSchema,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";
import { LLMClient } from "./llm_client";
import {
  LLMContentBlock,
  LLMMessage,
  LLMStreamEvent,
  ToolDefinition,
} from "../ai_agent/types";

export type AiSdkProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "openai-compatible"

export interface AiSdkLLMClientConfig {
  provider: AiSdkProvider;
  model: string;
  apiKey: string;
  baseURL?: string;
  providerName?: string;
  providerOptions?: Record<string, unknown>;
  maxOutputTokens?: number;
  includeRawChunks?: boolean;
}

export class AiSdkLLMClient implements LLMClient {
  private controller: AbortController | null = null;

  constructor(private config: AiSdkLLMClientConfig) {}

  async *stream(params: {
    system: string;
    messages: LLMMessage[];
    tools: ToolDefinition[];
  }): AsyncIterable<LLMStreamEvent> {
    this.controller = new AbortController();
    const startedToolCalls = new Set<string>();

    try {
      const result = streamText({
        model: this.createModel(),
        system: params.system,
        messages: toModelMessages(params.messages),
        tools: toToolSet(params.tools),
        maxRetries: 0,
        maxOutputTokens: this.config.maxOutputTokens,
        providerOptions: this.config.providerOptions as never,
        includeRawChunks: this.config.includeRawChunks,
        abortSignal: this.controller.signal,
      });

      for await (const part of result.fullStream) {
        switch (part.type) {
          case "text-delta":
            yield { type: "text_delta", text: part.text };
            break;

          case "reasoning-delta":
            yield { type: "thinking_delta", text: part.text };
            break;

          case "tool-input-start":
            startedToolCalls.add(part.id);
            yield { type: "tool_use_start", id: part.id, name: part.toolName };
            break;

          case "tool-input-delta":
            yield { type: "tool_use_delta", id: part.id, inputJson: part.delta };
            break;

          case "tool-call":
            if (!startedToolCalls.has(part.toolCallId)) {
              yield {
                type: "tool_use_start",
                id: part.toolCallId,
                name: part.toolName,
              };
            }
            yield {
              type: "tool_use_end",
              id: part.toolCallId,
              input: asToolInput(part.input),
            };
            break;

          case "finish-step":
            yield {
              type: "message_end",
              usage: {
                inputTokens: part.usage.inputTokens ?? 0,
                outputTokens: part.usage.outputTokens ?? 0,
              },
            };
            break;

          case "error":
            yield {
              type: "error",
              error:
                part.error instanceof Error
                  ? part.error
                  : new Error(String(part.error)),
            };
            break;
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      yield {
        type: "error",
        error: err instanceof Error ? err : new Error(String(err)),
      };
    } finally {
      this.controller = null;
    }
  }

  abort(): void {
    this.controller?.abort();
  }

  private createModel(): LanguageModel {
    switch (this.config.provider) {
      case "openai":
        return createOpenAI({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseURL,
        })(this.config.model);

      case "anthropic":
        return createAnthropic({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseURL,
        })(this.config.model);

      case "google":
        return createGoogleGenerativeAI({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseURL,
        })(this.config.model);

      case "xai":
        return createXai({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseURL,
        })(this.config.model);

      case "openai-compatible":
        return createOpenAICompatible({
          name: this.config.providerName ?? "openai-compatible",
          apiKey: this.config.apiKey,
          baseURL: requiredBaseURL(this.config),
        })(this.config.model);
    }
  }
}

function toToolSet(tools: ToolDefinition[]): ToolSet | undefined {
  if (tools.length === 0) return undefined;

  return Object.fromEntries(
    tools.map((tool) => [
      tool.name,
      {
        description: tool.description,
        inputSchema: jsonSchema(tool.inputSchema),
      },
    ]),
  );
}

function toModelMessages(messages: LLMMessage[]): ModelMessage[] {
  const toolNamesById = collectToolNames(messages);

  return messages
    .map((message): ModelMessage | null => {
      if (message.role === "user") {
        return {
          role: "user",
          content: message.content
            .filter((block): block is Extract<LLMContentBlock, { type: "text" }> => block.type === "text")
            .map((block) => block.text)
            .join(""),
        };
      }

      if (message.role === "assistant") {
        const content: unknown[] = [];
        for (const block of message.content) {
          switch (block.type) {
            case "text":
              content.push({ type: "text", text: block.text });
              break;
            case "thinking":
              content.push({ type: "reasoning", text: block.thinking });
              break;
            case "tool_use":
              content.push({
                type: "tool-call",
                toolCallId: block.id,
                toolName: block.name,
                input: block.input,
              });
              break;
          }
        }

        return {
          role: "assistant",
          content,
        } as ModelMessage;
      }

      const toolResults = message.content.flatMap((block) => {
        if (block.type !== "tool_result") return [];

        return [
          {
            type: "tool-result" as const,
            toolCallId: block.tool_use_id,
            toolName: toolNamesById.get(block.tool_use_id) ?? "unknown",
            output: { type: "text" as const, value: block.content },
          },
        ];
      });

      if (toolResults.length === 0) return null;
      return { role: "tool", content: toolResults } as ModelMessage;
    })
    .filter((message): message is ModelMessage => message !== null);
}

function collectToolNames(messages: LLMMessage[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;

    for (const block of message.content) {
      if (block.type === "tool_use") {
        names.set(block.id, block.name);
      }
    }
  }
  return names;
}

function asToolInput(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

function requiredBaseURL(config: AiSdkLLMClientConfig): string {
  if (!config.baseURL) {
    throw new Error("baseURL is required for openai-compatible AI SDK clients");
  }
  return config.baseURL;
}
