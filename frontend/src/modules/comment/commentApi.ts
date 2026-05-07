import apiClient from '@/modules/apiClient'
import type { AppComment } from '@/types'
import type { CommentThread, RootCommentMeta } from './types'

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

export async function postComment (params: PostCommentParams): Promise<AppComment> {
  const response = await apiClient.post<{ comment: AppComment }>(
    '/comments',
    params
  )
  return response.data.comment
}
