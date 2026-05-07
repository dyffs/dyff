import { Queue, Worker } from 'bullmq'
import JobModel from '@/database/job'
import { getSource } from '@/module/jobs/source_registry'
import { MAX_PER_TEAM, WORKER_CONCURRENCY } from '@/module/jobs/constants'
import { logger } from '@/service/logger'

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
}

export const queue = new Queue('dyff-jobs', { connection })

async function processJob(bullJob: any) {
  const { jobId } = bullJob.data
  const job = await JobModel.findByPk(jobId)
  if (!job || job.status !== 'pending') return

  // Per-team concurrency gate
  const runningCount = await JobModel.count({
    where: { team_id: job.team_id, status: 'running' },
  })
  if (runningCount >= MAX_PER_TEAM) {
    // Don't re-enqueue — onJobFinished will pick it up
    return
  }

  // Optimistic lock: claim the job
  const [updated] = await JobModel.update(
    { status: 'running', started_at: new Date() },
    { where: { id: jobId, status: 'pending' } },
  )
  if (updated === 0) return

  try {
    const handler = getSource(job.source_type)
    await handler.execute_async(job.payload, job)
    await JobModel.update(
      { status: 'completed', completed_at: new Date() },
      { where: { id: jobId } },
    )
  } catch (err: any) {
    logger.error(`Job ${jobId} failed`, { err })
    await JobModel.update(
      { status: 'failed', error: err.message, completed_at: new Date() },
      { where: { id: jobId } },
    )
  } finally {
    await onJobFinished(job.team_id)
  }
}

async function onJobFinished(teamId: string) {
  const runningCount = await JobModel.count({
    where: { team_id: teamId, status: 'running' },
  })

  const slotsAvailable = MAX_PER_TEAM - runningCount
  if (slotsAvailable <= 0) return

  const pendingJobs = await JobModel.findAll({
    where: { team_id: teamId, status: 'pending' },
    order: [['created_at', 'ASC']],
    limit: slotsAvailable,
  })

  for (const pendingJob of pendingJobs) {
    await queue.add('process-job', { jobId: pendingJob.id })
  }
}

export function initWorker() {
  const worker = new Worker('dyff-jobs', processJob, {
    connection,
    concurrency: WORKER_CONCURRENCY,
  })

  worker.on('error', (err) => {
    logger.error('Job worker error:', err)
  })

  logger.info('Job queue worker initialized')
  return worker
}


