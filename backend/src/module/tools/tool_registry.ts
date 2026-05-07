import User from "@/database/user";
import type { ToolDefinition, ToolResult, ChatSession } from "../ai_agent/types";

/**
 * A tool handler combines the definition (for LLM) with the execution logic.
 */
export interface ToolHandler {
  definition: ToolDefinition;
  execute(input: Record<string, unknown>, chatSession: ChatSession, currentUser: User): Promise<ToolResult>;
}

/**
 * Registry for managing available tools.
 * Provides definitions to the LLM and executes tool calls.
 */
export class ToolRegistry {
  private tools = new Map<string, ToolHandler>();

  register(handler: ToolHandler) {
    this.tools.set(handler.definition.name, handler);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async execute(
    name: string,
    input: Record<string, unknown>,
    chatSession: ChatSession,
    currentUser: User,
  ): Promise<ToolResult> {
    const handler = this.tools.get(name);
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    return handler.execute(input, chatSession, currentUser);
  }
}
