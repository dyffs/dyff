import type { ChatSessionStatus } from '@/types'
export interface TokenUsageSnapshot {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextTokens?: number;
}

export type EnrichedPart =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string }

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant' | 'tool_result'
  raw: string
  enriched?: EnrichedPart[]
  metadata: {
    generatedAt?: string
    cancelled?: boolean
    stale?: boolean
  }
}

export interface SerializedChatSession {
  id: string
  pull_request_id: string
  github_pr_number: number
  user_id: string
  team_id: string
  repository_id: string
  status: string
  session_data: {
    id: string
    messages: SessionMessage[]
    status: ChatSessionStatus
    totalUsage: TokenUsageSnapshot
    createdAt: string
    updatedAt: string
    commitHash: string
  }
  created_at: string
  updated_at: string
}

export interface ToolCallSummary {
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
  status: 'completed' | 'error'
}

/** One assistant iteration within the current turn (think → tool, or think → response) */
export interface AgentStep {
  stepIndex: number
  assistantMessageId: string
  text: string
  toolCalls: ToolCallSummary[]
  timestamp: string
}

export interface SessionProgress {
  sessionId: string
  status: ChatSessionStatus
  steps: AgentStep[]
  totalUsage: TokenUsageSnapshot
  updatedAt: string
}