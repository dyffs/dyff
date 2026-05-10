import apiClient from '@/modules/apiClient'
import type { AppComment } from '@/types'
import type { CommentThread, RootCommentMeta } from './types'
import type { CodeAnchor } from '@@/types'

export async function getRoots (pullRequestId: string): Promise<RootCommentMeta[]> {
  const response = await apiClient.get<{ roots: RootCommentMeta[] }>(
    '/comments/roots',
    { params: { pull_request_id: pullRequestId } }
  )
  return response.data.roots
}

export async function getThread (rootCommentId: string): Promise<CommentThread> {
  const response = await apiClient.get<{ comments: AppComment[] }>(
    `/comments/thread/${rootCommentId}`
  )
  return {
    id: rootCommentId,
    comments: response.data.comments
  }
}

export interface PostCommentParams {
  pull_request_id: string
  thread_id?: string
  content: string
  code_anchor?: AppComment['code_anchor']
}

export interface PostDiffCommentParams {
  pull_request_id: string
  body: string
  code_anchor: CodeAnchor
}

export async function postDiffComment (params: PostDiffCommentParams): Promise<AppComment> {
  const response = await apiClient.post<{ comment: AppComment }>(
    '/comments/diff',
    params
  )
  return response.data.comment
}

export interface PostReplyCommentParams {
  parent_comment_id: string
  body: string
}

export async function postReplyComment (params: PostReplyCommentParams): Promise<AppComment> {
  const response = await apiClient.post<{ comment: AppComment }>(
    '/comments/reply',
    params
  )
  return response.data.comment
}
