import CommentModel from '@/database/comment'
import { SerializedComment } from '@/module/comment/types'
import { PublicUserInfo } from '@/types'

export function serializeComment(comment: CommentModel, userInfo: Map<string, PublicUserInfo>): SerializedComment {
  const user = userInfo.get(comment.user_id)

  const userDisplayName = user?.github_username || user?.display_name || ''

  return {
    id: comment.id,
    thread_id: comment.thread_id,
    pull_request_id: comment.pull_request_id,
    user_id: comment.user_id,
    user_display_name: userDisplayName,
    origin: comment.origin,
    agent_type: comment.agent_type,
    status: comment.status,
    content: comment.content,
    attachments: comment.attachments,
    code_anchor: comment.code_anchor,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
  }
}

export function serializeComments(comments: CommentModel[], userInfo: Map<string, PublicUserInfo>): SerializedComment[] {
  return comments.map(comment => serializeComment(comment, userInfo))
}
