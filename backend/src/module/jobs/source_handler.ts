import type JobModel from '@/database/job'

export interface SourceHandler {
  execute_async(payload: any, job: JobModel): Promise<any>
}
