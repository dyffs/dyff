import ChatSessionModel from "@/database/chat_session";
import { SessionStore } from "./session_store";
import { ChatSession, StoredMessage, TokenUsageSnapshot } from "./types";

export class PgSessionStore implements SessionStore {
  async load(sessionId: string): Promise<ChatSession> {
    const row = await ChatSessionModel.findByPk(sessionId);
    if (!row) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }
    const session = row.session_data;
    session.status = row.status;
    return session;
  }

  async appendMessage(sessionId: string, message: StoredMessage): Promise<ChatSession> {
    const row = await ChatSessionModel.findByPk(sessionId);
    if (!row) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }

    const session = row.session_data;
    session.messages.push(message);
    session.totalUsage = message.metadata.cumulativeUsage ?? session.totalUsage;
    session.updatedAt = new Date().toISOString();

    row.session_data = session;
    row.changed('session_data', true);
    await row.save();

    return row.session_data;
  }

  async updateStatus(sessionId: string, status: ChatSession["status"]): Promise<ChatSession> {
    const [count, rows] = await ChatSessionModel.update(
      { status },
      { where: { id: sessionId }, returning: true },
    );
    if (count === 0 || !rows?.length) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }
    return rows[0].session_data;
  }

  async updateUsage(sessionId: string, usage: TokenUsageSnapshot): Promise<ChatSession> {
    const row = await ChatSessionModel.findByPk(sessionId);
    if (!row) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }

    const session = row.session_data;
    session.totalUsage = usage;
    session.updatedAt = new Date().toISOString();

    row.session_data = session;
    row.changed('session_data', true);
    await row.save();

    return row.session_data;
  }
}
