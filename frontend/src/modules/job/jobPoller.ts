import apiClient from '@/modules/apiClient'
import type { JobStatus, Job, AgentPollUpdate } from './types'


function isTerminal (status: JobStatus): boolean {
  return status === 'completed' || status === 'failed'
}

const POLL_INTERVAL = 3000

export interface AgentPollHandlers {
  onProgress: (update: AgentPollUpdate) => void
  onResult: (job: Job) => void
}

export function createJobPoller (interval = POLL_INTERVAL) {
  // /jobs/statuses/batch — job status only
  const batchPending = new Map<string, JobStatus>()
  let batchTimer: ReturnType<typeof setInterval> | null = null
  let batchOnResult: ((job: Job) => void) | null = null

  // /jobs/statuses/agent — job status + associated session progress
  const agentPending = new Map<string, JobStatus>()
  const agentHandlersMap = new Map<string, AgentPollHandlers>()
  let agentTimer: ReturnType<typeof setInterval> | null = null

  function pollResult (jobId: string, status: JobStatus, onResult: (job: Job) => void) {
    if (isTerminal(status)) return
    batchPending.set(jobId, status)
    batchOnResult = onResult
    if (!batchTimer) {
      batchTimer = setInterval(() => void pollBatch(), interval)
    }
  }

  function pollAgentResult (jobId: string, status: JobStatus, handlers: AgentPollHandlers) {
    if (isTerminal(status)) return
    agentPending.set(jobId, status)
    agentHandlersMap.set(jobId, handlers)
    if (!agentTimer) {
      agentTimer = setInterval(() => void pollAgent(), interval)
    }
  }

  async function pollBatch () {
    const ids = [...batchPending.keys()]
    if (ids.length === 0) {
      stopBatch()
      return
    }

    try {
      const { data } = await apiClient.get<{ id: string; status: JobStatus }[]>(
        `/jobs/statuses/batch?ids=${ids.join(',')}`
      )

      const statusMap = new Map(data.map((s) => [s.id, s.status]))

      for (const id of ids) {
        const newStatus = statusMap.get(id)
        if (!newStatus) continue

        if (isTerminal(newStatus)) {
          batchPending.delete(id)
          const { data: fullJob } = await apiClient.get<Job>(`/jobs/${id}`)
          batchOnResult?.(fullJob)
        } else {
          batchPending.set(id, newStatus)
        }
      }

      if (batchPending.size === 0) stopBatch()
    } catch (err) {
      console.error('Error polling job statuses (batch):', err)
    }
  }

  async function pollAgent () {
    const ids = [...agentPending.keys()]
    if (ids.length === 0) {
      stopAgent()
      return
    }

    try {
      const { data } = await apiClient.get<AgentPollUpdate>(
        `/jobs/statuses/agent?jobIds=${ids.join(',')}`
      )

      for (const [, handlers] of agentHandlersMap) {
        handlers.onProgress(data)
      }

      const jobMap = new Map(data.jobs.map((j) => [j.id, j]))

      for (const id of ids) {
        const job = jobMap.get(id)
        if (!job) continue

        if (isTerminal(job.status)) {
          agentPending.delete(id)
          const handler = agentHandlersMap.get(id)
          const { data: fullJob } = await apiClient.get<Job>(`/jobs/${id}`)
          handler?.onResult(fullJob)
          agentHandlersMap.delete(id)
        } else {
          agentPending.set(id, job.status)
        }
      }

      if (agentPending.size === 0) stopAgent()
    } catch (err) {
      console.error('Error polling job statuses (agent):', err)
    }
  }

  function stopBatch () {
    if (batchTimer) {
      clearInterval(batchTimer)
      batchTimer = null
    }
    batchPending.clear()
  }

  function stopAgent () {
    if (agentTimer) {
      clearInterval(agentTimer)
      agentTimer = null
    }
    agentPending.clear()
    agentHandlersMap.clear()
  }

  return { pollResult, pollAgentResult }
}
