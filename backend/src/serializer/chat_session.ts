import ChatSessionModel from '@/database/chat_session'
import type { ChatSession, StoredMessage, TokenUsageSnapshot } from '@/module/ai_agent/types'

export interface SerializedChatSession {
  id: string
  pull_request_id: string
  github_pr_number: number
  user_id: string
  team_id: string
  repository_id: string
  status: ChatSession['status']
  session_data: {
    id: string
    agentName: string
    messages: StoredMessage[]
    status: ChatSession['status']
    totalUsage: TokenUsageSnapshot
    createdAt: string
    updatedAt: string
    commitHash: string
  }
  created_at: Date
  updated_at: Date
}

export function serializeChatSession(session: ChatSessionModel): SerializedChatSession {
  const { systemPrompt: _systemPrompt, ...sessionDataWithoutPrompt } = session.session_data
  return {
    id: session.id,
    pull_request_id: session.pull_request_id,
    github_pr_number: session.github_pr_number,
    user_id: session.user_id,
    team_id: session.team_id,
    repository_id: session.repository_id,
    status: session.status,
    session_data: sessionDataWithoutPrompt,
    created_at: session.created_at,
    updated_at: session.updated_at,
  }
}

export function serializeChatSessions(sessions: ChatSessionModel[]): SerializedChatSession[] {
  return sessions.map(serializeChatSession)
}
