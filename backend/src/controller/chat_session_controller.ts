import { requestContext } from '@/service/requestContext'
import { Request, Response } from 'express'
import express from 'express'
import ChatSessionModel from '@/database/chat_session'
import { Op, literal } from 'sequelize'
import { createChatSession, readSystemPrompt } from '@/module/orchestrator/factory'
import { serializeChatSession, serializeChatSessions } from '@/serializer/chat_session'
import { buildSessionProgress } from '@/module/ai_agent/session_progress'
import { assertPullRequestAccess } from '@/service/permission_service'
import { enqueueJob } from '@/module/jobs/enqueue'
import { logger } from '@/service/logger'

const router = express.Router()

// Create a new chat session
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { pullRequestId  } = req.body

    const { pullRequest, repository } = await assertPullRequestAccess(user.id, pullRequestId)

    // TODO: revise system prompt
    const systemPrompt = readSystemPrompt('chat_bot_v1')

    const session = await createChatSession({
      user,
      agentName: 'kai',
      commitHash: pullRequest.head_commit_sha,
      pullRequestId: pullRequest.id,
      repoId: repository.id,
      githubPrNumber: pullRequest.github_pr_number,
      systemPrompt,
    })

    return res.status(201).json(serializeChatSession(session))
  } catch (error) {
    logger.error('Error creating chat session:', error)
    return res.status(500).json({
      error: 'Failed to create chat session',
      message: (error as Error).message,
    })
  }
})

// Add a new user message and trigger an async agent turn
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { id } = req.params
    const { message } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' })
    }

    const session = await ChatSessionModel.findOne({
      where: { id, user_id: user.id },
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    await assertPullRequestAccess(user.id, session.pull_request_id)

    const job = await enqueueJob({
      userId: user.id,
      teamId: user.team_id,
      sourceType: 'chat_turn_workflow',
      sourceId: session.id,
      payload: {
        sessionId: session.id,
        userMessage: message,
      },
      chatSessionId: session.id,
    })

    return res.status(202).json({ jobId: job.id, status: job.status, sessionId: session.id })
  } catch (error) {
    logger.error('Error creating chat turn job:', error)
    return res.status(500).json({
      error: 'Failed to create chat turn job',
      message: (error as Error).message,
    })
  }
})

// List sessions for a pull request
router.get('/pull_request/:pullRequestId', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { pullRequestId } = req.params

    await assertPullRequestAccess(user.id, pullRequestId)

    const sessions = await ChatSessionModel.findAll({
      where: {
        pull_request_id: pullRequestId,
        user_id: user.id,
        [Op.and]: literal(`session_data->>'agentName' = 'kai'`),
      },
      order: [['created_at', 'DESC']],
    })

    return res.status(200).json(serializeChatSessions(sessions))
  } catch (error) {
    logger.error('Error listing chat sessions:', error)
    return res.status(500).json({
      error: 'Failed to list chat sessions',
      message: (error as Error).message,
    })
  }
})

// Get a single session
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { id } = req.params

    const session = await ChatSessionModel.findOne({
      where: { id, user_id: user.id },
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    return res.status(200).json(serializeChatSession(session))
  } catch (error) {
    logger.error('Error fetching chat session:', error)
    return res.status(500).json({
      error: 'Failed to fetch chat session',
      message: (error as Error).message,
    })
  }
})

// Get session progress (lightweight polling endpoint)
router.get('/:id/progress', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { id } = req.params

    const session = await ChatSessionModel.findOne({
      where: { id, user_id: user.id },
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    return res.status(200).json(buildSessionProgress(session))
  } catch (error) {
    logger.error('Error fetching session progress:', error)
    return res.status(500).json({
      error: 'Failed to fetch session progress',
      message: (error as Error).message,
    })
  }
})

// Delete a session
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { id } = req.params

    const session = await ChatSessionModel.findOne({
      where: { id, user_id: user.id },
    })

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    await session.destroy()

    return res.status(200).json({ success: true })
  } catch (error) {
    logger.error('Error deleting chat session:', error)
    return res.status(500).json({
      error: 'Failed to delete chat session',
      message: (error as Error).message,
    })
  }
})

export default router
