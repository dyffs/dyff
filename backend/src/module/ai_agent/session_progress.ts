import ChatSessionModel from '@/database/chat_session'
import type { ChatSession, LLMContentBlock, StoredMessage, TokenUsageSnapshot } from './types'

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
  /** Truncated assistant text (first ~200 chars) */
  text: string
  toolCalls: ToolCallSummary[]
  timestamp: string
}

export interface SessionProgress {
  sessionId: string
  status: ChatSession['status']
  /** Steps within the current (last) turn — from the last user message onward */
  steps: AgentStep[]
  totalUsage: TokenUsageSnapshot
  updatedAt: string
}

export function buildSessionProgress(session: ChatSessionModel): SessionProgress {
  const data = session.session_data
  const steps: AgentStep[] = []

  const start = findLastUserMessageIndex(data.messages) + 1

  for (let i = start; i < data.messages.length; i++) {
    const msg = data.messages[i]
    if (msg.role !== 'assistant') continue

    const toolCalls: ToolCallSummary[] = []
    for (const block of msg.enriched) {
      if (block.type === 'tool_use') {
        const hasResult = findToolResult(data.messages, i, block.id)
        toolCalls.push({
          toolCallId: block.id,
          toolName: block.name,
          input: block.input,
          status: hasResult ? 'completed' : 'error',
        })
      }
    }

    let text = msg.enriched
      .filter((b): b is Extract<LLMContentBlock, { type: 'thinking' }> => b.type === 'thinking')
      .map((b) => b.thinking)
      .join('')
    
    if (text.length > 1000) {
      text = text.slice(0, 1000) + '...'
    }

    steps.push({
      stepIndex: steps.length,
      assistantMessageId: msg.id,
      text,
      toolCalls,
      timestamp: msg.metadata.generatedAt ?? '',
    })
  }

  return {
    sessionId: data.id,
    status: session.status,
    steps,
    totalUsage: data.totalUsage,
    updatedAt: data.updatedAt,
  }
}

function findLastUserMessageIndex(messages: StoredMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return i
  }
  return -1
}

/** Check if a tool_result exists for a given tool_use_id after position `afterIndex`. */
function findToolResult(messages: StoredMessage[], afterIndex: number, toolUseId: string): boolean {
  for (let j = afterIndex + 1; j < messages.length; j++) {
    const m = messages[j]
    if (m.role !== 'tool_result') continue
    if (m.enriched.some((e) => e.type === 'tool_result' && e.tool_use_id === toolUseId)) {
      return true
    }
  }
  return false
}
