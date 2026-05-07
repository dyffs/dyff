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

// Create a new comment
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const {
      pull_request_id: pullRequestId,
      thread_id: threadId,
      content,
      code_anchor: codeAnchor,
    } = req.body

    if (!pullRequestId) {
      return res.status(400).json({ error: 'pull_request_id is required' })
    }

    const { pullRequest, repository } = await assertPullRequestAccess(user.id, pullRequestId)

    const comment = await CommentModel.create({
      pull_request_id: pullRequestId,
      thread_id: threadId ?? null,
      user_id: user.id,
      team_id: user.team_id,
      origin: 'human',
      agent_type: null,
      status: 'active',
      content: {
        body: content,
        body_html: null,
        diff_hunk: null,
      },
      attachments: {},
      code_anchor: codeAnchor ?? null,
    })

    const userInfo = await getPublicUserInfo([user.id])
    const serializedComment = serializeComment(comment, userInfo)

    return res.status(201).json({
      ...serializedComment,
      comment: serializedComment,
    })
  } catch (error) {
    logger.error('Error creating comment:', error)
    return res.status(500).json({
      error: 'Failed to create comment',
      message: (error as Error).message,
    })
  }
})

// List comments for a pull request
router.get('/pull_request/:pullRequestId', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { pullRequestId } = req.params

    await assertPullRequestAccess(user.id, pullRequestId)

    const visibilityFilter = buildCommentVisibilityFilter(user.team_id)

    const comments = await CommentModel.findAll({
      where: {
        [Op.and]: [
          { pull_request_id: pullRequestId },
          visibilityFilter,
        ],
      },
      order: [['created_at', 'ASC']],
    })

    const userInfo = await getPublicUserInfo(comments.map(comment => comment.user_id))

    return res.status(200).json(serializeComments(comments, userInfo))
  } catch (error) {
    logger.error('Error listing comments:', error)
    return res.status(500).json({
      error: 'Failed to list comments',
      message: (error as Error).message,
    })
  }
})

// Update a comment
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { id } = req.params
    const { status, content, attachments } = req.body

    const comment = await CommentModel.findOne({
      where: { id, user_id: user.id },
    })

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    if (status !== undefined) comment.status = status
    if (content !== undefined) comment.content = content
    if (attachments !== undefined) comment.attachments = attachments

    await comment.save()

    const userInfo = await getPublicUserInfo([user.id])

    return res.status(200).json(serializeComment(comment, userInfo))
  } catch (error) {
    logger.error('Error updating comment:', error)
    return res.status(500).json({
      error: 'Failed to update comment',
      message: (error as Error).message,
    })
  }
})

// Delete a comment
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { id } = req.params

    const comment = await CommentModel.findOne({
      where: { id, user_id: user.id },
    })

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' })
    }

    await comment.destroy()

    return res.status(200).json({ success: true })
  } catch (error) {
    logger.error('Error deleting comment:', error)
    return res.status(500).json({
      error: 'Failed to delete comment',
      message: (error as Error).message,
    })
  }
})

export default router
