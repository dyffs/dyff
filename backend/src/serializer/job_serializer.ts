import JobModel from '@/database/job'

export function serializeJob(job: JobModel) {
  return {
    id: job.id,
    userId: job.user_id,
    teamId: job.team_id,
    sourceType: job.source_type,
    payload: job.payload,
    status: job.status,
    result: job.result,
    error: job.error,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  }
}
