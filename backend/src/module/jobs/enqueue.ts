import JobModel from '@/database/job'
import { MAX_PER_TEAM } from './constants'
import { queue } from '@/module/jobs/job_queue_service'

export async function enqueueJob(params: {
  userId: string
  teamId: string | null
  sourceType: string
  sourceId: string
  payload: Record<string, any>
  chatSessionId?: string
}): Promise<JobModel> {
  const job = await JobModel.create({
    user_id: params.userId,
    team_id: params.teamId,
    source_type: params.sourceType,
    source_id: params.sourceId,
    payload: params.payload,
    status: 'pending',
    chat_session_id: params.chatSessionId ?? null,
  })

  // Only enqueue to BullMQ if user has capacity
  const runningCount = await JobModel.count({
    where: { team_id: params.teamId, status: 'running' },
  })

  if (runningCount < MAX_PER_TEAM) {
    await queue.add('process-job', { jobId: job.id })
  }
  // If at capacity, job stays as 'pending' in DB.
  // onJobFinished will enqueue it when a slot opens.

  return job
}