import GithubCredential from '@/database/github_credential'
import GithubCommentSyncModel from '@/database/github_comment_sync'
import { getPullRequestReviewComments, getPullRequestIssueComments } from '@/service/github_comment_api'

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

/**
 * Fetch GitHub comments for a pull request into the github_comment_syncs table.
 * New comments are inserted with sync_state='pending_pull'.
 * Existing comments are updated and re-marked as pending_pull if GitHub has a newer version.
 */
export async function fetchGithubComments(options: FetchGithubCommentsOptions): Promise<FetchResult> {
  const { credential, pullRequestId, initiatorId, initiatorTeamId, owner, repo, pullNumber } = options

  const [reviewComments, issueComments] = await Promise.all([
    getPullRequestReviewComments(credential, owner, repo, pullNumber),
    getPullRequestIssueComments(credential, owner, repo, pullNumber),
  ])

  const existingSyncs = await GithubCommentSyncModel.findAll({
    where: { pull_request_id: pullRequestId },
  })

  const existingSyncsMap = new Map(existingSyncs.map(s => [s.github_comment_id, s]))

  let created = 0
  let updated = 0
  let unchanged = 0

  for (const comment of reviewComments) {
    const githubCommentId = String(comment.id)
    const remoteUpdatedAt = new Date(comment.updated_at)

    const codeAnchor = {
      commit_sha: comment.commit_id,
      file_path: comment.path,
      line_start: comment.start_line ?? comment.original_start_line ?? 0,
      start_side: (comment.start_side ?? 'RIGHT') as 'LEFT' | 'RIGHT',
      line_end: comment.line ?? comment.original_line ?? 0,
      end_side: (comment.side ?? 'RIGHT') as 'LEFT' | 'RIGHT',
    }

    const content = {
      body: comment.body,
      diff_hunk: comment.diff_hunk,
      html_url: comment.html_url,
      avatar_url: comment.user.avatar_url,
    }

    const existing = existingSyncsMap.get(githubCommentId)

    if (!existing) {
      await GithubCommentSyncModel.create({
        initiator_id: initiatorId,
        initiator_team_id: initiatorTeamId,
        pull_request_id: pullRequestId,
        github_user_name: comment.user.login,
        github_comment_id: githubCommentId,
        github_thread_id: comment.in_reply_to_id?.toString() ?? null,
        content,
        attachments: {},
        code_anchor: codeAnchor,
        sync_state: 'pending_pull',
        sync_direction: 'inbound',
        sync_error: null,
        remote_updated_at: remoteUpdatedAt,
      })
      created++
    } else if (existing.remote_updated_at < remoteUpdatedAt) {
      await existing.update({
        github_user_name: comment.user.login,
        github_thread_id: comment.in_reply_to_id?.toString() ?? null,
        content,
        code_anchor: codeAnchor,
        sync_state: 'pending_pull',
        remote_updated_at: remoteUpdatedAt,
      })
      updated++
    } else {
      unchanged++
    }
  }

  for (const comment of issueComments) {
    const githubCommentId = String(comment.id)
    const remoteUpdatedAt = new Date(comment.updated_at)

    const content = {
      body: comment.body,
      diff_hunk: null,
      html_url: comment.html_url,
      avatar_url: comment.user.avatar_url,
    }

    const existing = existingSyncsMap.get(githubCommentId)

    if (!existing) {
      await GithubCommentSyncModel.create({
        initiator_id: initiatorId,
        initiator_team_id: initiatorTeamId,
        pull_request_id: pullRequestId,
        github_user_name: comment.user.login,
        github_comment_id: githubCommentId,
        github_thread_id: null,
        content,
        attachments: {},
        code_anchor: null,
        sync_state: 'pending_pull',
        sync_direction: 'inbound',
        sync_error: null,
        remote_updated_at: remoteUpdatedAt,
      })
      created++
    } else if (existing.remote_updated_at < remoteUpdatedAt) {
      await existing.update({
        github_user_name: comment.user.login,
        content,
        sync_state: 'pending_pull',
        remote_updated_at: remoteUpdatedAt,
      })
      updated++
    } else {
      unchanged++
    }
  }

  return { created, updated, unchanged }
}
