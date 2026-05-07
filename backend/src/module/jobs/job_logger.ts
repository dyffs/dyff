import JobLogModel from '@/database/job_log'
import JobModel from '@/database/job'

type Severity = 'info' | 'warn' | 'error' | 'debug'

export async function logJob(message: string, severity: Severity, job: JobModel) {
  await JobLogModel.create({
    job_id: job.id,
    team_id: job.team_id,
    user_id: job.user_id,
    severity,
    data: { message },
  })
}
