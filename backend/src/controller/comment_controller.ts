import { requestContext } from '@/service/requestContext'
import { Request, Response } from 'express'
import express from 'express'
import CommentModel from '@/database/comment'
import ChatSessionModel from '@/database/chat_session'
import { serializeComment, serializeComments } from '@/serializer/comment'
import { assertPullRequestAccess } from '@/service/permission_service'
import { Op } from 'sequelize'
import { getPublicUserInfo } from '@/service/utils'
import { logger } from '@/service/logger'
import { getWriteCredential, CredentialNotFoundError } from '@/service/github_credential_service'
import { submitDiffComment, submitReplyComment } from '@/module/comment/submit_github_comment'

const router = express.Router()

function buildCommentVisibilityFilter(teamId: string) {
  return {
    [Op.or]: [
      { team_id: teamId },
      { origin: 'github' },
    ],
  }
}

// Lightweight list of root comments for polling.
router.get('/roots', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const pullRequestId = (req.query.pull_request_id ?? req.query.pullRequestId) as string | undefined

    if (!pullRequestId) {
      return res.status(400).json({ error: 'pull_request_id query parameter is required' })
    }

    await assertPullRequestAccess(user.id, pullRequestId)

    const visibilityFilter = buildCommentVisibilityFilter(user.team_id)

    const comments = await CommentModel.findAll({
      attributes: ['id', 'thread_id', 'status', 'updated_at', 'origin', 'agent_chat_session_id'],
      where: {
        [Op.and]: [
          { pull_request_id: pullRequestId },
          visibilityFilter,
        ],
      },
      order: [['updated_at', 'DESC']],
    })

    const rootsById = new Map<string, {
      id: string
      status: CommentModel['status']
      origin: CommentModel['origin']
      agent_chat_session_id: CommentModel['agent_chat_session_id']
      agent_chat_session_status: string | null
      thread_map: Record<string, {
        updated_at: Date
        status: CommentModel['status']
        origin: CommentModel['origin']
      }>
      updated_at: Date
    }>()

    for (const comment of comments) {
      if (comment.thread_id !== null) {
        continue
      }

      rootsById.set(comment.id, {
        id: comment.id,
        status: comment.status,
        origin: comment.origin,
        agent_chat_session_id: comment.agent_chat_session_id,
        agent_chat_session_status: null,
        thread_map: {},
        updated_at: comment.updated_at,
      })
    }

    for (const comment of comments) {
      const rootId = comment.thread_id ?? comment.id
      const rootMeta = rootsById.get(rootId)
      if (!rootMeta) {
        continue
      }

      rootMeta.thread_map[comment.id] = {
        updated_at: comment.updated_at,
        status: comment.status,
        origin: comment.origin,
      }

      if (comment.updated_at > rootMeta.updated_at) {
        rootMeta.updated_at = comment.updated_at
      }
    }

    // Batch-fetch chat session statuses for roots that have an agent session
    const sessionIds = [...rootsById.values()]
      .map((r) => r.agent_chat_session_id)
      .filter((id): id is string => id != null)

    if (sessionIds.length > 0) {
      const sessions = await ChatSessionModel.findAll({
        attributes: ['id', 'status'],
        where: { id: sessionIds },
      })
      const statusById = new Map(sessions.map((s) => [s.id, s.status]))
      for (const root of rootsById.values()) {
        if (root.agent_chat_session_id) {
          root.agent_chat_session_status = statusById.get(root.agent_chat_session_id) ?? null
        }
      }
    }

    const roots = Array.from(rootsById.values())
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())

    return res.status(200).json({
      roots,
    })
  } catch (error) {
    logger.error('Error listing root comments:', error)
    return res.status(500).json({
      error: 'Failed to list root comments',
      message: (error as Error).message,
    })
  }
})

// Fetch the root + replies for a single thread.
router.get('/thread/:rootCommentId', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { rootCommentId } = req.params

    const rootComment = await CommentModel.findOne({
      where: {
        id: rootCommentId,
        thread_id: null,
      },
    })

    if (!rootComment) {
      return res.status(404).json({ error: 'Root comment not found' })
    }

    await assertPullRequestAccess(user.id, rootComment.pull_request_id)

    const visibilityFilter = buildCommentVisibilityFilter(user.team_id)
    const isRootVisible = rootComment.team_id === user.team_id || rootComment.origin === 'github'

    if (!isRootVisible) {
      return res.status(404).json({ error: 'Root comment not found' })
    }

    const comments = await CommentModel.findAll({
      where: {
        [Op.and]: [
          { pull_request_id: rootComment.pull_request_id },
          {
            // The root comment does not have a thread_id but we want to include it
            // in the thread, so we use this OR
            [Op.or]: [
              { id: rootCommentId },
              { thread_id: rootCommentId },
            ],
          },
          visibilityFilter,
        ],
      },
      order: [['created_at', 'ASC']],
    })

    const userInfo = await getPublicUserInfo(comments.map(comment => comment.user_id))

    return res.status(200).json({
      comments: serializeComments(comments, userInfo),
    })
  } catch (error) {
    logger.error('Error fetching comment thread:', error)
    return res.status(500).json({
      error: 'Failed to fetch comment thread',
      message: (error as Error).message,
    })
  }
})


// Post a new diff comment to GitHub and persist it locally.
router.post('/diff', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { pull_request_id, body, code_anchor } = req.body ?? {}

    if (!pull_request_id || typeof body !== 'string' || !body.trim() || !code_anchor) {
      return res.status(400).json({
        error: 'pull_request_id, body, and code_anchor are required',
      })
    }

    const requiredAnchorFields = ['commit_sha', 'file_path', 'line_start', 'side', 'line_end']
    for (const field of requiredAnchorFields) {
      if (code_anchor[field] === undefined || code_anchor[field] === null) {
        return res.status(400).json({ error: `code_anchor.${field} is required` })
      }
    }

    const { pullRequest, repository } = await assertPullRequestAccess(user.id, pull_request_id)
    const credential = await getWriteCredential(user)

    const comment = await submitDiffComment({
      credential,
      user,
      pullRequest,
      repository,
      body,
      codeAnchor: code_anchor,
    })

    const userInfo = await getPublicUserInfo([comment.user_id])
    return res.status(201).json({ comment: serializeComment(comment, userInfo) })
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return res.status(404).json({ error: error.message, code: error.code })
    }
    logger.error('Error submitting diff comment:', error)
    return res.status(500).json({
      error: 'Failed to submit diff comment',
      message: (error as Error).message,
    })
  }
})

// Post a reply to an existing GitHub review comment thread and persist locally.
router.post('/reply', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { parent_comment_id, body } = req.body ?? {}

    if (!parent_comment_id || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({
        error: 'parent_comment_id and body are required',
      })
    }

    const parentComment = await CommentModel.findByPk(parent_comment_id)
    if (!parentComment) {
      return res.status(404).json({ error: 'Parent comment not found' })
    }

    const { pullRequest, repository } = await assertPullRequestAccess(user.id, parentComment.pull_request_id)
    const credential = await getWriteCredential(user)

    const comment = await submitReplyComment({
      credential,
      user,
      pullRequest,
      repository,
      body,
      parentCommentId: parent_comment_id,
    })

    const userInfo = await getPublicUserInfo([comment.user_id])
    return res.status(201).json({ comment: serializeComment(comment, userInfo) })
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return res.status(404).json({ error: error.message, code: error.code })
    }
    logger.error('Error submitting reply comment:', error)
    return res.status(500).json({
      error: 'Failed to submit reply comment',
      message: (error as Error).message,
    })
  }
})

export default router
