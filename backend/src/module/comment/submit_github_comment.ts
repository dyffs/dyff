import GithubCredential from '@/database/github_credential'
import GithubCommentSyncModel from '@/database/github_comment_sync'
import CommentModel from '@/database/comment'
import PullRequest from '@/database/pull_request'
import Repository from '@/database/repository'
import User from '@/database/user'
import { createDiffComment, replyToComment } from '@/service/github_comment_api'
import { GithubReviewComment } from '@/types'
import { Comment, GithubCommentSync } from './types'
import { normalizeCodeAnchor } from '@/service/utils'
interface SubmitDiffCommentInput {
  credential: GithubCredential
  user: User
  pullRequest: PullRequest
  repository: Repository
  body: string
  codeAnchor: NonNullable<Comment['code_anchor']>
}

interface SubmitReplyCommentInput {
  credential: GithubCredential
  user: User
  pullRequest: PullRequest
  repository: Repository
  body: string
  // Internal id of the comment being replied to. Either a thread root
  // or any reply within the thread — we resolve to the root for thread_id
  // and use the parent's github_comment_id for the GitHub reply call.
  parentCommentId: string
}

interface SyncContent {
  body: string | null
  diff_hunk: string | null
  html_url: string
  avatar_url: string
}

function buildSyncContent(c: GithubReviewComment): SyncContent {
  return {
    body: c.body,
    diff_hunk: c.diff_hunk,
    html_url: c.html_url,
    avatar_url: c.user.avatar_url,
  }
}

/**
 * Persist a freshly-pushed GitHub review comment locally without re-fetching
 * the entire comment list. Writes the github_comment_sync row in `synced`
 * state, creates the canonical Comment, and links them.
 */
async function persistSubmittedReviewComment(params: {
  user: User
  pullRequest: PullRequest
  github: GithubReviewComment
  threadId: string | null
  githubThreadId: string | null
}): Promise<CommentModel> {
  const { user, pullRequest, github, threadId, githubThreadId } = params

  const now = new Date()
  const githubCreatedAt = new Date(github.created_at)
  const githubUpdatedAt = new Date(github.updated_at)
  const content = buildSyncContent(github)

  const codeAnchor = normalizeCodeAnchor({
    commit_sha: github.commit_id,
    file_path: github.path,
    original_line: github.original_line,
    line: github.line,
    start_line: github.start_line,
    original_start_line: github.original_start_line,
    start_side: github.start_side,
    side: github.side,
  })

  const comment = await CommentModel.create({
    pull_request_id: pullRequest.id,
    user_id: user.id,
    team_id: user.team_id,
    thread_id: threadId,
    origin: 'github',
    agent_type: null,
    status: 'active',
    content: {
      body: content.body,
      body_html: null,
      diff_hunk: content.diff_hunk,
    },
    attachments: {},
    code_anchor: codeAnchor,
    created_at: githubCreatedAt,
    updated_at: githubUpdatedAt,
  })

  await GithubCommentSyncModel.create({
    initiator_id: user.id,
    initiator_team_id: user.team_id,
    pull_request_id: pullRequest.id,
    github_user_name: github.user.login,
    github_comment_id: String(github.id),
    github_thread_id: githubThreadId,
    comment_kind: 'review_comment',
    content,
    attachments: {},
    code_anchor: codeAnchor,
    sync_state: 'synced',
    sync_error: null,
    last_synced_at: now,
    github_created_at: githubCreatedAt,
    github_updated_at: githubUpdatedAt,
    comment_id: comment.id,
  })

  return comment
}

export async function submitDiffComment(input: SubmitDiffCommentInput): Promise<CommentModel> {
  const { credential, user, pullRequest, repository, body, codeAnchor } = input

  const github = await createDiffComment(
    credential,
    repository.github_owner,
    repository.github_repo,
    pullRequest.github_pr_number,
    {
      body,
      commit_id: codeAnchor.commit_sha,
      code_anchor: codeAnchor,
    }
  ) as GithubReviewComment

  return persistSubmittedReviewComment({
    user,
    pullRequest,
    github,
    threadId: null,
    githubThreadId: null,
  })
}

export async function submitReplyComment(input: SubmitReplyCommentInput): Promise<CommentModel> {
  const { credential, user, pullRequest, repository, body, parentCommentId } = input

  const parentComment = await CommentModel.findByPk(parentCommentId)
  if (!parentComment) {
    throw new Error(`Parent comment not found: ${parentCommentId}`)
  }
  if (parentComment.pull_request_id !== pullRequest.id) {
    throw new Error('Parent comment does not belong to the given pull request')
  }

  // GitHub flattens review-comment threads under the root: every reply's
  // in_reply_to_id points to the root, not the immediate predecessor. So we
  // resolve to the local root and reply against the root's github_comment_id.
  const threadRootId = parentComment.thread_id ?? parentComment.id

  const rootSync = await GithubCommentSyncModel.findOne({
    where: {
      pull_request_id: pullRequest.id,
      comment_id: threadRootId,
      comment_kind: 'review_comment',
    },
  })
  if (!rootSync || !rootSync.github_comment_id) {
    throw new Error('Thread root is not a GitHub-synced review comment')
  }

  const github = await replyToComment(
    credential,
    pullRequest.github_pr_number,
    repository.github_owner,
    repository.github_repo,
    rootSync.github_comment_id,
    body,
  ) as GithubReviewComment

  return persistSubmittedReviewComment({
    user,
    pullRequest,
    github,
    threadId: threadRootId,
    githubThreadId: rootSync.github_comment_id,
  })
}
