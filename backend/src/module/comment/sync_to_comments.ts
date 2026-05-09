import { Op } from 'sequelize'
import GithubCommentSyncModel from '@/database/github_comment_sync'
import CommentModel from '@/database/comment'
import { findOrCreateUsersByGithubUsername } from '@/service/user_service'
import { logger } from '@/service/logger'

interface SyncToCommentsOptions {
  pullRequestId: string
  teamId: string
}

interface SyncToCommentsResult {
  created: number
  updated: number
}

/**
 * Sync pending_pull records from github_comment_syncs into the comments table.
 *
 * For new sync records (comment_id is null): creates a comment and stores the comment_id back.
 * For existing sync records (comment_id set): updates the comment content.
 * After syncing, marks each record as sync_state='synced' and sets last_synced_at.
 *
 * A second pass assigns thread_id on reply comments using the github_thread_id →
 * github_comment_id → internal comment_id mapping.
 */
export async function syncGithubCommentsToComments(options: SyncToCommentsOptions): Promise<SyncToCommentsResult> {
  const { pullRequestId, teamId } = options

  const pendingSyncs = await GithubCommentSyncModel.findAll({
    where: {
      pull_request_id: pullRequestId,
      sync_state: 'pending_pull',
    },
  })

  if (pendingSyncs.length === 0) {
    return { created: 0, updated: 0 }
  }

  const githubUsernames = [...new Set(pendingSyncs.map(s => s.github_user_name))]
  const userMap = await findOrCreateUsersByGithubUsername(githubUsernames, teamId)

  // Seed the mapping from already-synced records so thread links work across runs
  const alreadySynced = await GithubCommentSyncModel.findAll({
    where: {
      pull_request_id: pullRequestId,
      comment_id: { [Op.not]: null },
    },
  })

  const githubCommentToCommentId = new Map<string, string>(
    alreadySynced
      .filter(r => r.comment_id != null && r.github_comment_id != null)
      .map(r => [r.github_comment_id!, r.comment_id!])
  )

  let created = 0
  let updated = 0

  // First pass: create or update comments
  for (const sync of pendingSyncs) {
    const user = userMap.get(sync.github_user_name)
    if (!user) {
      logger.error(`Failed to find user for github username: ${sync.github_user_name}`)
      await sync.update({ sync_error: `User not found: ${sync.github_user_name}` })
      continue
    }

    const commentContent = {
      body: sync.content.body ?? null,
      body_html: null,
      diff_hunk: sync.content.diff_hunk ?? null,
    }

    try {
      if (sync.comment_id) {
        const comment = await CommentModel.findByPk(sync.comment_id)
        if (comment) {
          await comment.update({
            content: commentContent,
            code_anchor: sync.code_anchor,
            attachments: sync.attachments,
            updated_at: sync.github_updated_at ?? new Date(),
          })
          updated++
        }
      } else {
        const comment = await CommentModel.create({
          pull_request_id: pullRequestId,
          user_id: user.id,
          team_id: teamId,
          thread_id: null,
          origin: 'github',
          agent_type: null,
          status: 'active',
          content: commentContent,
          attachments: sync.attachments,
          code_anchor: sync.code_anchor,
          created_at: sync.github_created_at ?? new Date(),
          updated_at: sync.github_updated_at ?? new Date(),
        })

        await sync.update({ comment_id: comment.id })
        if (sync.github_comment_id) {
          githubCommentToCommentId.set(sync.github_comment_id, comment.id)
        }
        created++
      }
    } catch (error) {
      logger.error(`Error syncing github_comment_sync ${sync.id}:`, error)
      await sync.update({ sync_error: (error as Error).message })
    }
  }

  // Second pass: link reply comments to their parent via thread_id
  for (const sync of pendingSyncs) {
    if (!sync.github_thread_id || !sync.comment_id) continue

    const parentCommentId = githubCommentToCommentId.get(sync.github_thread_id)
    if (!parentCommentId) continue

    const comment = await CommentModel.findByPk(sync.comment_id)
    if (comment && comment.thread_id !== parentCommentId) {
      await comment.update({ thread_id: parentCommentId })
    }
  }

  // Mark successfully synced records
  for (const sync of pendingSyncs) {
    if (!sync.comment_id) continue
    await sync.update({
      sync_state: 'synced',
      last_synced_at: new Date(),
      sync_error: null,
    })
  }

  return { created, updated }
}
