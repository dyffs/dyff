import type { SessionProgress } from '@/modules/agent/types'

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Job {
  id: string
  userId: string
  teamId: string
  sourceType: string
  payload: Record<string, unknown>
  status: JobStatus
  result: unknown
  error: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentJobStatus {
  id: string
  chat_session_id: string
  status: JobStatus
  error: string | null
}

export interface AgentPollUpdate {
  jobs: AgentJobStatus[]
  sessions: SessionProgress[]
}