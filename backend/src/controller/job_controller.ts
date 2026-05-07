import { Router } from 'express'
import { Op } from 'sequelize'
import JobModel from '@/database/job'
import { requestContext } from '@/service/requestContext'
import { serializeJob } from '@/serializer/job_serializer'
import { logger } from '@/service/logger'
import ChatSessionModel from '@/database/chat_session'
import { buildSessionProgress } from '@/module/ai_agent/session_progress'

const router = Router()


router.get('/statuses/batch', async (req, res) => {
  try {
    const user = requestContext.currentUser()
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const ids = req.query.ids
    if (!ids || typeof ids !== 'string') {
      return res.status(400).json({ error: 'ids query parameter is required' })
    }

    const jobIds = ids.split(',')

    const jobs = await JobModel.findAll({
      attributes: ['id', 'status', 'error'],
      where: {
        id: { [Op.in]: jobIds },
        team_id: user.team_id,
      },
    })

    return res.json(jobs.map(job => ({ id: job.id, status: job.status, error: job.error })))
  } catch (err: any) {
    logger.error('Error fetching job statuses:', err)
    return res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const user = requestContext.currentUser()
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const job = await JobModel.findOne({
      where: {
        id: req.params.id,
        user_id: user.id,
      },
    })

    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }
    return res.json(serializeJob(job))
  } catch (err: any) {
    logger.error('Error fetching job:', err)
    return res.status(500).json({ error: err.message })
  }
})

function parseIds(value: unknown): string[] {
  if (!value || typeof value !== 'string') return []
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

router.get('/statuses/agent', async (req, res) => {
  try {
    const user = requestContext.currentUser()

    const jobIds = parseIds(req.query.jobIds)
    if (jobIds.length === 0) {
      return res.json({ jobs: [], sessions: [] })
    }

    const jobs = await JobModel.findAll({
      attributes: ['id', 'status', 'error', 'source_type', 'source_id', 'chat_session_id'],
      where: {
        id: { [Op.in]: jobIds },
        team_id: user.team_id,
      },
    })

    const associatedSessions = await ChatSessionModel.findAll({
      where: {
        id: { [Op.in]: jobs.map(job => job.chat_session_id) },
        user_id: user.id,
      },
    })

    const sessionProgresses = associatedSessions.map(buildSessionProgress)

    return res.json({
      jobs: jobs.map(job => ({ id: job.id, chat_session_id: job.chat_session_id, status: job.status, error: job.error })),
      sessions: sessionProgresses,
    })
  } catch (err: any) {
    logger.error('Error polling agent statuses:', err)
    return res.status(500).json({ error: err.message })
  }
})

export default router
