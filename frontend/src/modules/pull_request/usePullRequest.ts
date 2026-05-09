import { createInjectionState } from '@vueuse/core'
import { shallowRef, ref } from 'vue'
import type { SerializedPullRequest } from '@/types'
import { useRepo } from '../repo/useRepo'
import { listPullRequests, getPullRequestDetails, getPullRequestDiff } from './pullRequestApi'

const [useProvidePullRequest, usePullRequest] = createInjectionState(() => {
  const { currentUsername } = useRepo()!

  const pullRequests = shallowRef<SerializedPullRequest[]>([])
  const diffStore = new Map<string, string>()

  const isLoading = ref(false)
  const isUpdating = ref(false)
  const currentOwner = ref<string | null>(null)
  const currentRepo = ref<string | null>(null)

  const updatingMap = new Map<string, Promise<SerializedPullRequest>>()

  const fetchEpoch = ref(0)

  async function fetchPullRequests (owner: string, repo: string) {
    const epoch = ++fetchEpoch.value
    isLoading.value = true
    try {
      const prs = await listPullRequests(owner, repo)

      if (epoch !== fetchEpoch.value) return

      pullRequests.value = prs.sort((a, b) => {
        return new Date(b.github_updated_at).getTime() - new Date(a.github_updated_at).getTime()
      })

      currentOwner.value = owner
      currentRepo.value = repo
    } catch (error) {
      if (epoch !== fetchEpoch.value) return
      console.error('Failed to fetch pull requests:', error)
      throw error
    } finally {
      if (epoch === fetchEpoch.value) {
        isLoading.value = false
      }
    }
  }

  async function updatePullRequestDetails (id: string): Promise<SerializedPullRequest> {
    if (updatingMap.has(id)) {
      return updatingMap.get(id)!
    }

    try {
      const promise = getPullRequestDetails(id)
      updatingMap.set(id, promise)

      const data = await promise
      // Update the PR in the list
      const index = pullRequests.value.findIndex(pr => pr.id === id)
      if (index !== -1) {
        pullRequests.value[index] = data
      }
      return data
    } catch (error) {
      console.error(`Failed to update PR ${id}:`, error)
      throw error
    } finally {
      updatingMap.delete(id)
    }
  }

  async function fetchPullRequestDiff (id: string) {
    try {
      if (diffStore.has(id)) {
        return diffStore.get(id)
      }
      const data = await getPullRequestDiff(id)
      diffStore.set(id, data.diff)

      return data.diff
    } catch (error) {
      console.error(`Failed to fetch diff for PR ${id}:`, error)
      throw error
    }
  }

  async function fetchPrDetails (prNumber: number): Promise<SerializedPullRequest> {
    const trackedPr = pullRequests.value.find(pr => pr.github_pr_number === prNumber)

    if (!trackedPr) {
      throw new Error(`PR ${prNumber} not found`)
    }

    if (updatingMap.has(trackedPr.id)) {
      return updatingMap.get(trackedPr.id)!
    }

    try {
      const promise = getPullRequestDetails(trackedPr.id)
      updatingMap.set(trackedPr.id, promise)

      const prDetails = await promise
      return prDetails
    } catch (error) {
      console.error(`Failed to fetch PR details for ${trackedPr.id}:`, error)
      throw error
    } finally {
      updatingMap.delete(trackedPr.id)
    }
  }

  async function init (owner: string, repo: string) {
    try {
      await fetchPullRequests(owner, repo)
    } catch (error) {
      console.error('Failed to init pull requests:', error)
      throw error
    }
  }

  return {
    pullRequests,
    isLoading,
    isUpdating,
    currentOwner,
    currentRepo,
    fetchPullRequests,
    updatePullRequestDetails,
    fetchPullRequestDiff,
    fetchPrDetails,
    init,
    currentUsername,
  }
})

export { useProvidePullRequest, usePullRequest }
