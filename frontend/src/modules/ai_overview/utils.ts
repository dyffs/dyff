import type { Job } from '../job/types'


export function showGenerateButton (job: Job | null | undefined) {
  if (!job) return true

  if (['completed', 'failed'].includes(job.status)) return true

  const now = new Date().getTime()
  const sinceJobCreated = now - new Date(job.createdAt).getTime()

  // 20 minutes, prevent job stuck for too long
  return sinceJobCreated > 20 * 60 * 1000
}