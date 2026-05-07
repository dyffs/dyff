import PullRequest from '@/database/pull_request'
import CommentModel from '@/database/comment'
import { getPublicUserInfo } from '@/service/utils'
import { SerializedComment } from '@/module/comment/types'
import { StoredReview, StoredTimelineEvent, PublicUserInfo } from '@/types'
import { serializeComment } from './comment'

export type { SerializedComment }

export interface SerializedPullRequest {
  id: string
  repository_id: string
  author_id: string
  author_github_username: string | null
  github_pr_id: number
  github_pr_number: number
  github_url: string
  reviewers: {
    github_usernames: string[]
  }
  title: string
  description: string | null
  html_description: string | null
  github_status: 'open' | 'closed' | 'merged'
  github_merged_at: Date | null
  base_branch: string
  head_branch: string
  head_commit_sha: string
  fastpr_status: 'skipped' | 'tracked'
  github_created_at: Date
  github_updated_at: Date
  review_rounds: {
    reviews: StoredReview[]
  }
  timeline: {
    events: StoredTimelineEvent[]
  }
  meta: {
    draft: boolean
  }
  up_to_date: boolean
  created_at: Date
  updated_at: Date
  comments?: SerializedComment[]
}

export function serializeComments(comments: CommentModel[], userInfo: Map<string, PublicUserInfo>): SerializedComment[] {
  return comments.map(comment => serializeComment(comment, userInfo))
}

export async function serializePullRequest(
  pullRequest: PullRequest,
  options: { includeComments?: boolean, userInfo?: Map<string, PublicUserInfo> }
): Promise<SerializedPullRequest> {

  let userInfo = options.userInfo || new Map()
  if (!options.userInfo) {
    userInfo = await getPublicUserInfo([pullRequest.author_id])
  }

  const serialized: SerializedPullRequest = {
    id: pullRequest.id,
    repository_id: pullRequest.repository_id,
    author_id: pullRequest.author_id,
    author_github_username: userInfo.get(pullRequest.author_id)?.github_username || null,
    github_pr_id: pullRequest.github_pr_id,
    github_pr_number: pullRequest.github_pr_number,
    github_url: pullRequest.github_url,
    reviewers: pullRequest.reviewers,
    title: pullRequest.title,
    description: pullRequest.description || null,
    html_description: pullRequest.html_description || null,
    github_status: pullRequest.github_status,
    github_merged_at: pullRequest.github_merged_at,
    base_branch: pullRequest.base_branch,
    head_branch: pullRequest.head_branch,
    head_commit_sha: pullRequest.head_commit_sha,
    fastpr_status: pullRequest.fastpr_status,
    github_created_at: pullRequest.github_created_at,
    github_updated_at: pullRequest.github_updated_at,
    review_rounds: pullRequest.review_rounds,
    timeline: pullRequest.timeline,
    up_to_date: pullRequest.up_to_date,
    created_at: pullRequest.created_at,
    updated_at: pullRequest.updated_at,
    meta: pullRequest.meta,
  }

  if (options?.includeComments) {
    const comments = await CommentModel.findAll({
      where: {
        pull_request_id: pullRequest.id,
      },
      order: [['created_at', 'ASC']],
    })

    userInfo = await getPublicUserInfo(comments.map(comment => comment.user_id))
    serialized.comments = serializeComments(comments, userInfo)
  }

  return serialized
}

export async function serializePullRequests(
  pullRequests: PullRequest[],
  options?: { includeComments?: boolean }
): Promise<SerializedPullRequest[]> {

  const authorIds = pullRequests.map(pr => pr.author_id)
  const publicUserInfo = await getPublicUserInfo(authorIds)

  return Promise.all(pullRequests.map(pr => serializePullRequest(pr, {
    ...options,
    userInfo: publicUserInfo,
  })))
}
