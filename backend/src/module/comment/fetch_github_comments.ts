import GithubCredential from '@/database/github_credential'
import GithubCommentSyncModel from '@/database/github_comment_sync'
import { getPullRequestReviewComments, getPullRequestIssueComments } from '@/service/github_comment_api'
import { GithubReviewComment, GithubIssueComment } from '@/types'
import { GithubCommentSync } from './types'

// The JSONB `content` column on github_comment_syncs stores extra UI fields
// (html_url, avatar_url) beyond the canonical Comment.content shape.
interface SyncContent {
  body: string | null
  diff_hunk: string | null
  html_url: string
  avatar_url: string
}

interface FetchGithubCommentsOptions {
  credential: GithubCredential
  pullRequestId: string
  initiatorId: string
  initiatorTeamId: string
  owner: string
  repo: string
  pullNumber: number
}

interface FetchResult {
  created: number
  updated: number
  unchanged: number
}

// Endpoint-agnostic shape used to drive the create/update logic. Both GitHub
// endpoints are normalized into this so a single loop handles both kinds.
interface NormalizedComment {
  github_comment_id: string
  github_user_name: string
  github_thread_id: string | null
  comment_kind: 'review_comment' | 'issue_comment'
  content: SyncContent
  code_anchor: GithubCommentSync['code_anchor']
  github_created_at: Date
  github_updated_at: Date
}

interface SyncCreatePayload {
  initiator_id: string
  initiator_team_id: string
  pull_request_id: string
  github_user_name: string
  github_comment_id: string
  github_thread_id: string | null
  comment_kind: NormalizedComment['comment_kind']
  content: SyncContent
  attachments: object
  code_anchor: GithubCommentSync['code_anchor']
  sync_state: 'pending_pull'
  sync_error: null
  github_created_at: Date
  github_updated_at: Date
}

function normalizeReviewComment(c: GithubReviewComment): NormalizedComment {
  return {
    github_comment_id: String(c.id),
    github_user_name: c.user.login,
    github_thread_id: c.in_reply_to_id?.toString() ?? null,
    comment_kind: 'review_comment',
    content: {
      body: c.body,
      diff_hunk: c.diff_hunk,
      html_url: c.html_url,
      avatar_url: c.user.avatar_url,
    },
    code_anchor: {
      commit_sha: c.commit_id,
      file_path: c.path,
      line_start: c.start_line ?? c.original_start_line ?? 0,
      start_side: (c.start_side ?? 'RIGHT') as 'LEFT' | 'RIGHT',
      line_end: c.line ?? c.original_line ?? 0,
      end_side: (c.side ?? 'RIGHT') as 'LEFT' | 'RIGHT',
    },
    github_created_at: new Date(c.created_at),
    github_updated_at: new Date(c.updated_at),
  }
}

function normalizeIssueComment(c: GithubIssueComment): NormalizedComment {
  return {
    github_comment_id: String(c.id),
    github_user_name: c.user.login,
    github_thread_id: null,
    comment_kind: 'issue_comment',
    content: {
      body: c.body,
      diff_hunk: null,
      html_url: c.html_url,
      avatar_url: c.user.avatar_url,
    },
    code_anchor: null,
    github_created_at: new Date(c.created_at),
    github_updated_at: new Date(c.updated_at),
  }
}

/**
 * Fetch GitHub comments for a pull request into the github_comment_syncs table.
 *
 * Performance: rather than re-downloading every comment on every poll, this
 * computes a per-(PR, kind) watermark — MAX(github_updated_at) — and passes
 * it to GitHub as the `since` parameter. The two endpoints (review comments
 * vs. issue comments) have independent update streams, so each gets its own
 * watermark; mixing them would cause one stream's churn to suppress fetches
 * from the other.
 *
 * The watermark query is index-backed by the composite index on
 * (pull_request_id, comment_kind, github_updated_at).
 *
 * Writes are batched: new rows go through a single bulkCreate and updates
 * fan out via Promise.all, instead of N sequential awaits.
 */
export async function fetchGithubComments(options: FetchGithubCommentsOptions): Promise<FetchResult> {
  const { credential, pullRequestId, initiatorId, initiatorTeamId, owner, repo, pullNumber } = options

  const [reviewWatermark, issueWatermark] = await Promise.all([
    GithubCommentSyncModel.max('github_updated_at', {
      where: { pull_request_id: pullRequestId, comment_kind: 'review_comment' },
    }) as Promise<Date | string | null>,
    GithubCommentSyncModel.max('github_updated_at', {
      where: { pull_request_id: pullRequestId, comment_kind: 'issue_comment' },
    }) as Promise<Date | string | null>,
  ])

  const reviewSince = reviewWatermark ? new Date(reviewWatermark).toISOString() : undefined
  const issueSince = issueWatermark ? new Date(issueWatermark).toISOString() : undefined

  const [reviewComments, issueComments] = await Promise.all([
    getPullRequestReviewComments(credential, owner, repo, pullNumber, { since: reviewSince }),
    getPullRequestIssueComments(credential, owner, repo, pullNumber, { since: issueSince }),
  ])

  const normalized: NormalizedComment[] = [
    ...reviewComments.map(normalizeReviewComment),
    ...issueComments.map(normalizeIssueComment),
  ]

  if (normalized.length === 0) {
    return { created: 0, updated: 0, unchanged: 0 }
  }

  // GitHub's `since` is inclusive (>= since), so the boundary comment may come
  // back. Scope the existing-row lookup to the IDs we actually received instead
  // of loading every sync row for the PR.
  const existingSyncs = await GithubCommentSyncModel.findAll({
    where: {
      pull_request_id: pullRequestId,
      github_comment_id: normalized.map(n => n.github_comment_id),
    },
  })
  const existingSyncsMap = new Map(existingSyncs.map(s => [s.github_comment_id, s]))

  const toCreate: SyncCreatePayload[] = []
  const toUpdate: Array<{ row: GithubCommentSyncModel; n: NormalizedComment }> = []
  let unchanged = 0

  for (const n of normalized) {
    const existing = existingSyncsMap.get(n.github_comment_id)

    if (!existing) {
      toCreate.push({
        initiator_id: initiatorId,
        initiator_team_id: initiatorTeamId,
        pull_request_id: pullRequestId,
        github_user_name: n.github_user_name,
        github_comment_id: n.github_comment_id,
        github_thread_id: n.github_thread_id,
        comment_kind: n.comment_kind,
        content: n.content,
        attachments: {},
        code_anchor: n.code_anchor,
        sync_state: 'pending_pull',
        sync_error: null,
        github_created_at: n.github_created_at,
        github_updated_at: n.github_updated_at,
      })
    } else if (!existing.github_updated_at || existing.github_updated_at < n.github_updated_at) {
      toUpdate.push({ row: existing, n })
    } else {
      unchanged++
    }
  }

  if (toCreate.length > 0) {
    await GithubCommentSyncModel.bulkCreate(toCreate as never)
  }

  if (toUpdate.length > 0) {
    await Promise.all(toUpdate.map(({ row, n }) => row.update({
      github_user_name: n.github_user_name,
      github_thread_id: n.github_thread_id,
      content: n.content,
      code_anchor: n.code_anchor,
      sync_state: 'pending_pull',
      github_updated_at: n.github_updated_at,
    })))
  }

  return { created: toCreate.length, updated: toUpdate.length, unchanged }
}
