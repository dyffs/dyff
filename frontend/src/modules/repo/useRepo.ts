import { createInjectionState } from '@vueuse/core'
import { shallowRef, ref } from 'vue'
import type { SerializedRepository } from '@/types'
import { listRepos, listTrackedRepos, trackRepos, untrackRepo } from './repoApi'
import { toast } from 'vue-sonner'
import { useAccount } from '@/modules/account/useAccount'

const CACHE_KEY = 'dyff_available_repos'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

interface CachedRepos {
  data: SerializedRepository[]
  timestamp: number
}

const [useProvideRepo, useRepo] = createInjectionState(() => {
  const availableRepos = shallowRef<SerializedRepository[]>([])
  const trackedRepos = shallowRef<SerializedRepository[]>([])
  const isLoadingAvailable = ref(false)
  const isLoadingTracked = ref(false)
  const isTracking = ref(false)

  function getCachedRepos (): SerializedRepository[] | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return null

      const { data, timestamp }: CachedRepos = JSON.parse(cached)
      const now = Date.now()

      if (now - timestamp < CACHE_DURATION) {
        return data
      }

      // Cache expired, remove it
      localStorage.removeItem(CACHE_KEY)
      return null
    } catch (error) {
      console.error('Error reading cache:', error)
      localStorage.removeItem(CACHE_KEY)
      return null
    }
  }

  function setCachedRepos (repos: SerializedRepository[]) {
    try {
      const cacheData: CachedRepos = {
        data: repos,
        timestamp: Date.now()
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
    } catch (error) {
      console.error('Error setting cache:', error)
    }
  }

  async function fetchAvailableRepos (forceRefresh = false) {
    isLoadingAvailable.value = true
    try {
      // Check cache first unless force refresh
      if (!forceRefresh) {
        const cached = getCachedRepos()
        if (cached) {
          availableRepos.value = cached
          isLoadingAvailable.value = false
          return cached
        }
      }

      // Fetch from API
      const data = await listRepos()
      availableRepos.value = data.repositories
      setCachedRepos(data.repositories)
      return data.repositories
    } catch (error) {
      const data = (error as any).data

      console.log(data)
      if ('code' in data && data.code === 'CREDENTIAL_NOT_FOUND') {
        availableRepos.value = []
        // another redirect flow to github setup will handle this
        return
      }

      toast.error(JSON.stringify(error))
      console.error(error)
      throw error
    } finally {
      isLoadingAvailable.value = false
    }
  }

  async function fetchTrackedRepos () {
    isLoadingTracked.value = true
    try {
      const data = await listTrackedRepos()
      trackedRepos.value = data.repositories
      return data.repositories
    } catch (error) {
      console.error('Failed to fetch tracked repos:', error)
      throw error
    } finally {
      isLoadingTracked.value = false
    }
  }

  async function trackRepositories (repos: { owner: string, repo: string }[]) {
    isTracking.value = true
    try {
      const data = await trackRepos(repos)
      trackedRepos.value = data.tracked_repositories
      return data.tracked_repositories
    } catch (error) {
      console.error('Failed to track repos:', error)
      throw error
    } finally {
      isTracking.value = false
    }
  }

  async function untrackRepository (repoId: string) {
    try {
      isTracking.value = true
      await untrackRepo(repoId)
      await fetchTrackedRepos()
    } catch (error) {
      console.error('Failed to untrack repo:', error)
      throw error
    } finally {
      isTracking.value = false
    }
  }

  return {
    availableRepos,
    trackedRepos,
    isLoadingAvailable,
    isLoadingTracked,
    isTracking,
    fetchAvailableRepos,
    fetchTrackedRepos,
    trackRepositories,
    untrackRepository,
  }
})

export { useProvideRepo, useRepo }