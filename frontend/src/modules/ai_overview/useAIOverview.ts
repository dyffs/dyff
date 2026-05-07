import type { SerializedPullRequest } from '@/types'
import { type Ref, shallowRef, computed, watch, ref } from 'vue'
import { createInjectionState } from '@vueuse/core'
import apiClient from '@/modules/apiClient'
import { createJobPoller } from '@/modules/job/jobPoller'
import type { Job } from '@/modules/job/types'
import type { SessionProgress } from '@/modules/agent/types'
import type { AgentPollUpdate } from '@/modules/job/types'
import { toast } from 'vue-sonner'

type SourceType = 'overview_workflow' | 'review_workflow'

const [useProvideAIOverview, useAIOverview] = createInjectionState((pr: Ref<SerializedPullRequest | null>) => {
  const jobs = ref<Record<SourceType, Job | null>>({
    overview_workflow: null,
    review_workflow: null,
  })

  const loading = shallowRef(false)
  const submitting = shallowRef(false)

  const overviewProgress = shallowRef<SessionProgress | null>(null)
  const reviewProgress = shallowRef<SessionProgress | null>(null)

  const overviewJobId = shallowRef<string | null>(null)
  const reviewJobId = shallowRef<string | null>(null)

  const overviewJob = computed(() => jobs.value.overview_workflow)
  const reviewJob = computed(() => jobs.value.review_workflow)

  function setJob (sourceType: SourceType, job: Job | null) {
    jobs.value = { ...jobs.value, [sourceType]: job }
  }

  const poller = createJobPoller()

  function handleAgentProgress (update: AgentPollUpdate) {
    for (const jobStatus of update.jobs) {
      const sp = update.sessions.find((s) => s.sessionId === jobStatus.chat_session_id)
      if (jobStatus.id === overviewJobId.value) {
        overviewProgress.value = sp ?? null
      } else if (jobStatus.id === reviewJobId.value) {
        reviewProgress.value = sp ?? null
      }
    }
  }

  function handleAgentResult (job: Job) {
    setJob(job.sourceType as SourceType, job)
    if (job.status !== 'completed') {
      toast.error(`Job ${job.id} ${job.sourceType} failed: ${job.error}`)
    }
  }

  function registerAgentPoll (jobId: string, status: Job['status']) {
    poller.pollAgentResult(jobId, status, {
      onProgress: handleAgentProgress,
      onResult: handleAgentResult,
    })
  }

  async function fetchRuns () {
    if (!pr.value) return
    loading.value = true
    try {
      const { data } = await apiClient.get<Job[]>(`/ai_reviews/${pr.value.id}/runs`)
      for (const job of data) {
        setJob(job.sourceType as SourceType, job)
        if (job.sourceType === 'overview_workflow') {
          overviewJobId.value = job.id
        } else if (job.sourceType === 'review_workflow') {
          reviewJobId.value = job.id
        }
        registerAgentPoll(job.id, job.status)
      }
    } catch (err) {
      console.error('Error fetching AI runs:', err)
    } finally {
      loading.value = false
    }
  }

  function buildJobObject (
    jobId: string,
    sourceType: SourceType,
    status: Job['status'],
  ): Job {
    return {
      id: jobId,
      userId: '',
      teamId: '',
      sourceType,
      payload: {},
      status,
      result: null,
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  async function submitBoth () {
    if (!pr.value) return
    submitting.value = true
    try {
      const [overviewRes, reviewRes] = await Promise.all([
        apiClient.post<{ jobId: string; status: Job['status'] }>('/ai_reviews/overview', {
          pullRequestId: pr.value.id,
          commitSha: pr.value.head_commit_sha,
          githubPrNumber: pr.value.github_pr_number,
        }),
        apiClient.post<{ jobId: string; status: Job['status'] }>('/ai_reviews/review', {
          pullRequestId: pr.value.id,
          commitSha: pr.value.head_commit_sha,
          githubPrNumber: pr.value.github_pr_number,
        }),
      ])

      const ovJobId = overviewRes.data.jobId
      const rvJobId = reviewRes.data.jobId

      overviewJobId.value = ovJobId
      reviewJobId.value = rvJobId

      setJob('overview_workflow', buildJobObject(ovJobId, 'overview_workflow', overviewRes.data.status))
      setJob('review_workflow', buildJobObject(rvJobId, 'review_workflow', reviewRes.data.status))

      registerAgentPoll(ovJobId, overviewRes.data.status)
      registerAgentPoll(rvJobId, reviewRes.data.status)
    } catch (err) {
      console.error('Error submitting both overview and review:', err)
    } finally {
      submitting.value = false
    }
  }

  watch(
    () => pr.value?.id,
    () => {
      jobs.value = { overview_workflow: null, review_workflow: null }
      overviewProgress.value = null
      reviewProgress.value = null
      overviewJobId.value = null
      reviewJobId.value = null
    },
    { immediate: true }
  )

  return {
    jobs,
    overviewJob,
    reviewJob,
    overviewProgress,
    reviewProgress,
    loading,
    submitting,
    fetchRuns,
    submitBoth,
  }
})

export { useProvideAIOverview, useAIOverview }