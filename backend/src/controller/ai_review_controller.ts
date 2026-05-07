import express from 'express'
import { requestContext } from '@/service/requestContext'
import { assertPullRequestAccess } from '@/service/permission_service'
import { enqueueJob } from '@/module/jobs/enqueue'
import { WorkflowPayload } from '@/module/workflow/types'
import JobModel from '@/database/job'
import { serializeJob } from '@/serializer/job_serializer'
import { logger } from '@/service/logger'

const router = express.Router()

router.post('/overview', async (req, res) => {
  try {
    const user = requestContext.currentUser()
    const { pullRequestId, commitSha, githubPrNumber } = req.body

    const { pullRequest, repository } = await assertPullRequestAccess(user.id, pullRequestId)

    const payload: WorkflowPayload = {
      pullRequestId: pullRequest.id,
      repositoryId: repository.id,
      commitSha,
      githubPrNumber,
      userMessage: ''
    }

    const job = await enqueueJob({
      userId: user.id,
      teamId: user.team_id,
      sourceType: 'overview_workflow',
      sourceId: pullRequest.id,
      payload,
    })

    return res.json({ jobId: job.id, status: job.status })
  } catch (err: any) {
    logger.error('Error creating overview job:', err)
    if (err.message === 'Access denied or resource not found') {
      return res.status(403).json({ error: err.message })
    }
    return res.status(500).json({ error: err.message })
  }
})

router.post('/review', async (req, res) => {
  try {
    const user = requestContext.currentUser()
    const { pullRequestId, commitSha, githubPrNumber } = req.body

    const { pullRequest, repository } = await assertPullRequestAccess(user.id, pullRequestId)

    const payload: WorkflowPayload = {
      pullRequestId: pullRequest.id,
      repositoryId: repository.id,
      commitSha,
      githubPrNumber,
      userMessage: ''
    }

    const job = await enqueueJob({
      userId: user.id,
      teamId: user.team_id,
      sourceType: 'review_workflow',
      sourceId: pullRequest.id,
      payload,
    })

    return res.json({ jobId: job.id, status: job.status })

  } catch (err: any) {
    logger.error('Error creating review job:', err)
    if (err.message === 'Access denied or resource not found') {
      return res.status(403).json({ error: err.message })
    }
  }
})

router.get('/:prId/runs', async (req, res) => {
  try {
    const user = requestContext.currentUser()

    const { prId } = req.params

    const { pullRequest } = await assertPullRequestAccess(user.id, prId) 

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const jobs = await JobModel.sequelize!.query(`
      (SELECT * FROM jobs WHERE team_id = :teamId AND source_id = :sourceId AND source_type = 'overview_workflow' ORDER BY created_at DESC LIMIT 1)
      UNION ALL
      (SELECT * FROM jobs WHERE team_id = :teamId AND source_id = :sourceId AND source_type = 'review_workflow' ORDER BY created_at DESC LIMIT 1)
    `, {
      replacements: { teamId: user.team_id, sourceId: pullRequest.id },
      model: JobModel,
      mapToModel: true,
    })

    return res.json(jobs.map(serializeJob))
  } catch (err: any) {
    logger.error('Error fetching overview runs:', err)
    return res.status(500).json({ error: err.message })
  }
})

export default router