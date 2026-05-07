import DraftReview from '@/database/draft_review'
import DraftComment from '@/database/draft_comment'
import { getPublicUserInfo } from '@/service/utils'
import { PublicUserInfo } from '@/types'

export interface SerializedDraftComment {
  id: string
  draft_review_id: string
  user_id: string
  user_github_username: string
  pull_request_id: string
  reply_to_github_comment_id: string | null
  content: {
    body: string | null
    diff_hunk: string | null
  }
  code_anchor: {
    commit_sha: string
    file_path: string
    line_start: number
    start_side: 'LEFT' | 'RIGHT'
    line_end: number
    end_side: 'LEFT' | 'RIGHT'
  } | null
  created_at: Date
  updated_at: Date
}

export interface SerializedDraftReview {
  id: string
  user_id: string
  user_github_username: string
  pull_request_id: string
  event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES'
  body: string | null
  status: 'draft' | 'submitting' | 'submitted' | 'failed'
  commit_sha: string
  github_review_id: string | null
  created_at: Date
  updated_at: Date
  draft_comments?: SerializedDraftComment[]
}

export function serializeDraftComment(
  comment: DraftComment,
  userInfo: Map<string, PublicUserInfo>
): SerializedDraftComment {
  return {
    id: comment.id,
    draft_review_id: comment.draft_review_id,
    user_id: comment.user_id,
    user_github_username: userInfo.get(comment.user_id)?.github_username || '',
    pull_request_id: comment.pull_request_id,
    reply_to_github_comment_id: comment.reply_to_github_comment_id,
    content: comment.content,
    code_anchor: comment.code_anchor,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
  }
}

export function serializeDraftComments(
  comments: DraftComment[],
  userInfo: Map<string, PublicUserInfo>
): SerializedDraftComment[] {
  return comments.map(comment => serializeDraftComment(comment, userInfo))
}

export async function serializeDraftReview(
  review: DraftReview,
  options?: { userInfo?: Map<string, PublicUserInfo> }
): Promise<SerializedDraftReview> {
  let userInfo = options?.userInfo || new Map()
  if (!options?.userInfo) {
    userInfo = await getPublicUserInfo([review.user_id])
  }

  const serialized: SerializedDraftReview = {
    id: review.id,
    user_id: review.user_id,
    user_github_username: userInfo.get(review.user_id)?.github_username || '',
    pull_request_id: review.pull_request_id,
    event: review.event,
    body: review.body,
    status: review.status,
    commit_sha: review.commit_sha,
    github_review_id: review.github_review_id,
    created_at: review.created_at,
    updated_at: review.updated_at,
  }

  // Optionally include comments
  const comments = await DraftComment.findAll({
    where: {
      draft_review_id: review.id,
    },
    order: [['created_at', 'ASC']],
  })

  const commentUserIds = [...new Set([review.user_id, ...comments.map(c => c.user_id)])]
  const commentUserInfo = await getPublicUserInfo(commentUserIds)
  serialized.draft_comments = serializeDraftComments(comments, commentUserInfo)

  return serialized
}

export async function serializeDraftReviews(
  reviews: DraftReview[],
): Promise<SerializedDraftReview[]> {
  const userIds = [...new Set(reviews.map(r => r.user_id))]
  const userInfo = await getPublicUserInfo(userIds)

  return Promise.all(
    reviews.map(review =>
      serializeDraftReview(review, {
        userInfo,
      })
    )
  )
}
