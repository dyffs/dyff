import { ChatSession, StoredMessage, MessageMetadata, TokenUsageSnapshot } from "./types";

/**
 * Persistence layer for chat sessions and messages.
 * Implementations will typically use a database (PostgreSQL via Sequelize).
 */
export interface SessionStore {
  load(sessionId: string): Promise<ChatSession>;
  appendMessage(sessionId: string, message: StoredMessage): Promise<ChatSession>;
  updateStatus(sessionId: string, status: ChatSession["status"]): Promise<ChatSession>;
  updateUsage(sessionId: string, usage: TokenUsageSnapshot): Promise<ChatSession>;
}
