import CommentModel from '@/database/comment'
import GithubCommentSyncModel from '@/database/github_comment_sync'
import User from '@/database/user'

interface SyncFromCommentsOptions {
  pullRequestId: string
  initiatorId: string
  initiatorTeamId: string
}

interface SyncFromCommentsResult {
  created: number
}

/**
 * Sync internal (origin='human') comments from the comments table into
 * github_comment_syncs with sync_state='pending_push'.
 *
 * Only comments that don't already have a sync record are processed.
 * The push logic (writing to GitHub) is handled separately.
 */
export async function syncFromComments(options: SyncFromCommentsOptions): Promise<SyncFromCommentsResult> {
  const { pullRequestId, initiatorId, initiatorTeamId } = options

  const comments = await CommentModel.findAll({
    where: {
      pull_request_id: pullRequestId,
      origin: 'human',
    },
  })

  if (comments.length === 0) return { created: 0 }

  // Find which comments already have a sync record
  const existingSyncs = await GithubCommentSyncModel.findAll({
    where: {
      pull_request_id: pullRequestId,
      comment_id: comments.map(c => c.id),
    },
  })

  const syncedCommentIds = new Set(existingSyncs.map(s => s.comment_id).filter(Boolean))
  const unsyncedComments = comments.filter(c => !syncedCommentIds.has(c.id))

  if (unsyncedComments.length === 0) return { created: 0 }

  const userIds = [...new Set(unsyncedComments.map(c => c.user_id))]
  const users = await User.findAll({ where: { id: userIds } })
  const userMap = new Map(users.map(u => [u.id, u]))

  let created = 0

  for (const comment of unsyncedComments) {
    const user = userMap.get(comment.user_id)

    await GithubCommentSyncModel.create({
      initiator_id: initiatorId,
      initiator_team_id: initiatorTeamId,
      pull_request_id: pullRequestId,
      github_user_name: user?.github_username ?? user?.display_name ?? '',
      github_comment_id: null,
      github_thread_id: null,
      content: comment.content,
      attachments: comment.attachments,
      code_anchor: comment.code_anchor,
      sync_state: 'pending_push',
      sync_direction: 'outbound',
      sync_error: null,
      remote_updated_at: comment.updated_at,
      comment_id: comment.id,
    })

    created++
  }

  return { created }
}
