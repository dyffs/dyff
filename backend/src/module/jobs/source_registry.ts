import type JobModel from '@/database/job'

type SourceHandlerClass = {
  execute_async(payload: any, job: JobModel): Promise<any>
}

const registry: Record<string, SourceHandlerClass> = {}

export function registerSource(sourceType: string, handler: SourceHandlerClass) {
  registry[sourceType] = handler
}

export function getSource(sourceType: string): SourceHandlerClass {
  const handler = registry[sourceType]
  if (!handler) throw new Error(`Unknown source_type: ${sourceType}`)
  return handler
}
