import { fetchRepoDetails, cloneRepo, getRepoContent } from './repoApi'
import type { SerializedRepository, RepoContent } from '@/types'
import { createIdbCache } from '@/lib/idbCache'

const repoContentIdbCache = createIdbCache<RepoContent>('repo-content')
interface PendingRequest {
  commitSha: string
  resolve: (content: RepoContent) => void
  reject: (error: Error) => void
}

interface RepoCloneState {
  status: 'new' | 'cloning' | 'cloned'
  pollInterval?: ReturnType<typeof setInterval>
  pendingRequests: PendingRequest[]
  repository?: SerializedRepository
}

/**
 * Global repository store service
 * Manages repository cloning and content fetching with intelligent request queuing
 * Includes in-memory caching to avoid redundant API calls
 */
class RepoStore {
  private cloneStates = new Map<string, RepoCloneState>()
  private contentCache = new Map<string, RepoContent>()
  private readonly POLL_INTERVAL_MS = 2000 // Poll every 2 seconds
  private readonly MAX_POLL_ATTEMPTS = 150 // Max 5 minutes of polling (150 * 2s)

  /**
   * Main method to read repository content at a specific commit
   * Handles cloning if necessary and queues requests during cloning
   * Uses in-memory cache to avoid redundant fetches
   */
  async readRepoAtCommit (
    owner: string,
    repo: string,
    commitSha: string
  ): Promise<RepoContent> {
    // Check cache first
    const contentKey = this.getContentCacheKey(owner, repo, commitSha)
    const cachedContent = this.contentCache.get(contentKey)
    if (cachedContent) {
      return cachedContent
    }

    const repoKey = this.getRepoKey(owner, repo)

    // Get or create clone state
    let state = this.cloneStates.get(repoKey)
    if (!state) {
      state = {
        status: 'new',
        pendingRequests: []
      }
      this.cloneStates.set(repoKey, state)
    }

    // Create a promise that will be resolved when content is ready
    return new Promise<RepoContent>((resolve, reject) => {
      const request: PendingRequest = {
        commitSha,
        resolve,
        reject
      }

      // Add to pending requests
      state.pendingRequests.push(request)

      // Handle based on current state
      if (state.status === 'new') {
        // First request for this repo, check status and potentially start cloning
        void this.initializeRepo(owner, repo, repoKey)
      } else if (state.status === 'cloning') {
        // Already cloning, just wait for the polling to complete
        // Request is already in the pending queue
      } else if (state.status === 'cloned') {
        // Already cloned, fetch content immediately
        void this.resolveRequest(owner, repo, request)
      }
    })
  }

  /**
   * Initialize a repository by checking its status and starting clone if needed
   */
  private async initializeRepo (owner: string, repo: string, repoKey: string): Promise<void> {
    const state = this.cloneStates.get(repoKey)
    if (!state) return

    try {
      // Fetch current repository status from backend
      const { repository } = await fetchRepoDetails(owner, repo)
      state.repository = repository
      state.status = repository.status

      if (repository.status === 'cloned') {
        // Already cloned, resolve all pending requests
        void this.resolveAllPendingRequests(owner, repo, repoKey)
      } else {
        // Need to clone, start the process
        void this.startCloneAndPoll(owner, repo, repoKey)
      }
    } catch (error) {
      // Failed to initialize, reject all pending requests
      this.rejectAllPendingRequests(repoKey, error as Error)
    }
  }

  /**
   * Start cloning operation and poll until complete
   */
  private async startCloneAndPoll (owner: string, repo: string, repoKey: string): Promise<void> {
    const state = this.cloneStates.get(repoKey)
    if (!state) return

    try {
      // Trigger clone if not already cloning
      if (state.status === 'new') {
        await cloneRepo(owner, repo)
        state.status = 'cloning'
      }

      // Start polling for completion
      let pollAttempts = 0
      state.pollInterval = setInterval(async () => {
        pollAttempts++

        try {
          const { repository } = await fetchRepoDetails(owner, repo)
          state.repository = repository

          if (repository.status === 'cloned') {
            // Clone complete, stop polling and resolve all requests
            this.stopPolling(repoKey)
            state.status = 'cloned'
            void this.resolveAllPendingRequests(owner, repo, repoKey)
          } else if (repository.status === 'new') {
            // Clone failed and was reset to 'new', retry
            this.stopPolling(repoKey)
            state.status = 'new'
            void this.startCloneAndPoll(owner, repo, repoKey)
          } else if (pollAttempts >= this.MAX_POLL_ATTEMPTS) {
            // Timeout after max attempts
            this.stopPolling(repoKey)
            throw new Error(
              `Cloning timeout: Repository ${owner}/${repo} took too long to clone`
            )
          }
        } catch (error) {
          // Error during polling, stop and reject all
          this.stopPolling(repoKey)
          this.rejectAllPendingRequests(repoKey, error as Error)
        }
      }, this.POLL_INTERVAL_MS)
    } catch (error) {
      // Failed to start clone, reject all pending requests
      this.stopPolling(repoKey)
      this.rejectAllPendingRequests(repoKey, error as Error)
    }
  }

  /**
   * Resolve a single request by fetching content
   * Caches the result for future requests
   */
  private async resolveRequest (
    owner: string,
    repo: string,
    request: PendingRequest
  ): Promise<void> {
    const contentKey = this.getContentCacheKey(owner, repo, request.commitSha)

    try {
      // L1: in-memory cache
      const memCached = this.contentCache.get(contentKey)
      if (memCached) {
        request.resolve(memCached)
        return
      }

      // L2: IndexedDB cache (commit SHAs are immutable, no TTL needed)
      const idbCached = await repoContentIdbCache.get(contentKey)
      if (idbCached) {
        this.contentCache.set(contentKey, idbCached)
        console.log('Repo content is fetched from IndexedDB cache')
        request.resolve(idbCached)
        return
      }

      // L3: Network
      const result = await getRepoContent(owner, repo, request.commitSha)
      console.log('Repo content is fetched from network')
      const repoContent: RepoContent = {
        files: result.content,
        commitSha: result.commit_sha,
        totalFiles: result.total_files
      }

      // Write-through to both caches
      this.contentCache.set(contentKey, repoContent)
      void repoContentIdbCache.set(contentKey, repoContent)

      request.resolve(repoContent)
    } catch (error) {
      request.reject(error as Error)
    }
  }

  /**
   * Resolve all pending requests for a repository
   */
  private async resolveAllPendingRequests (
    owner: string,
    repo: string,
    repoKey: string
  ): Promise<void> {
    const state = this.cloneStates.get(repoKey)
    if (!state) return

    // Process all pending requests
    const requests = [...state.pendingRequests]
    state.pendingRequests = []

    // Resolve each request concurrently
    const results = requests.map(request => this.resolveRequest(owner, repo, request))
    await Promise.allSettled(results)
  }

  /**
   * Reject all pending requests with an error
   */
  private rejectAllPendingRequests (repoKey: string, error: Error): void {
    const state = this.cloneStates.get(repoKey)
    if (!state) return

    const requests = [...state.pendingRequests]
    state.pendingRequests = []

    requests.forEach(request => request.reject(error))
  }

  /**
   * Stop polling for a repository
   */
  private stopPolling (repoKey: string): void {
    const state = this.cloneStates.get(repoKey)
    if (state?.pollInterval) {
      clearInterval(state.pollInterval)
      state.pollInterval = undefined
    }
  }

  /**
   * Generate a unique key for a repository
   */
  private getRepoKey (owner: string, repo: string): string {
    return `${owner}/${repo}`.toLowerCase()
  }

  /**
   * Generate a unique key for cached content
   */
  private getContentCacheKey (owner: string, repo: string, commitSha: string): string {
    return `${owner}/${repo}@${commitSha}`.toLowerCase()
  }

  /**
   * Get current status of a repository (for debugging/monitoring)
   */
  getRepoStatus (owner: string, repo: string): RepoCloneState | undefined {
    const repoKey = this.getRepoKey(owner, repo)
    return this.cloneStates.get(repoKey)
  }

  /**
   * Clear cached state for a repository (useful for testing or forced refresh)
   * Also clears all content cache for this repository
   */
  clearRepoState (owner: string, repo: string): void {
    const repoKey = this.getRepoKey(owner, repo)
    this.stopPolling(repoKey)
    this.cloneStates.delete(repoKey)

    // Clear all content cache for this repo
    this.clearRepoContentCache(owner, repo)
  }

  /**
   * Clear content cache for a specific commit (both L1 and L2)
   */
  clearContentCache (owner: string, repo: string, commitSha: string): void {
    const contentKey = this.getContentCacheKey(owner, repo, commitSha)
    this.contentCache.delete(contentKey)
    void repoContentIdbCache.delete(contentKey)
  }

  /**
   * Clear all content cache for a specific repository (both L1 and L2)
   */
  clearRepoContentCache (owner: string, repo: string): void {
    const repoPrefix = `${owner}/${repo}@`.toLowerCase()

    // Evict from L1
    const memKeysToDelete: string[] = []
    for (const key of this.contentCache.keys()) {
      if (key.startsWith(repoPrefix)) {
        memKeysToDelete.push(key)
      }
    }
    memKeysToDelete.forEach(key => this.contentCache.delete(key))

    // Evict matching keys from L2
    void repoContentIdbCache.keys().then(idbKeys => {
      for (const key of idbKeys) {
        if (key.startsWith(repoPrefix)) {
          void repoContentIdbCache.delete(key)
        }
      }
    })
  }

  /**
   * Clear all content cache (both L1 and L2)
   */
  clearAllContentCache (): void {
    this.contentCache.clear()
    void repoContentIdbCache.clear()
  }

  /**
   * Get cache statistics (for debugging/monitoring)
   */
  getCacheStats (): {
    cachedContentCount: number
    cachedRepos: string[]
    totalCachedFiles: number
  } {
    let totalFiles = 0
    const repos = new Set<string>()

    for (const [key, content] of this.contentCache.entries()) {
      totalFiles += content.totalFiles
      // Extract repo from key (format: owner/repo@commitSha)
      const repoMatch = key.match(/^(.+)@/)
      if (repoMatch?.[1]) {
        repos.add(repoMatch[1])
      }
    }

    return {
      cachedContentCount: this.contentCache.size,
      cachedRepos: Array.from(repos),
      totalCachedFiles: totalFiles
    }
  }

  /**
   * Clean up all polling intervals and clear all caches (should be called on app unmount)
   */
  cleanup (): void {
    for (const state of this.cloneStates.values()) {
      if (state.pollInterval) {
        clearInterval(state.pollInterval)
      }
    }
    this.cloneStates.clear()
    this.contentCache.clear()
  }
}

// Export singleton instance
export const repoStore = new RepoStore()
