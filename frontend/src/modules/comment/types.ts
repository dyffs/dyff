import type { AppComment, ChatSessionStatus } from '@/types'

export interface CommentThread {
  id: string
  comments: AppComment[]
}

export interface ThreadMeta {
  participantUsernames: string[]
  lastCommentAt: string
  totalComments: number
}

export interface PrMeta {
  participantUsernames: string[]
  totalThreads: number
}

export interface RootCommentMeta {
  id: string
  status: AppComment['status']
  origin: AppComment['origin']
  agent_chat_session_id: string | undefined
  agent_chat_session_status: ChatSessionStatus
  thread_map: {
    [commentId: string]: {
      updated_at: string
      status: AppComment['status']
      origin: AppComment['origin']
    }
  }
  updated_at: string
}
