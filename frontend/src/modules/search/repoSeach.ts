import type { RepoContent } from '@/types'
import type { WorkerRequest, WorkerResponse, SearchResponse } from './searchTypes'

class RepoSearchService {
  private worker: Worker | null = null
  private currentRepo: { owner: string, repo: string, commitSha: string } | null = null

  private initWorker (): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./repoSearch.worker.ts', import.meta.url),
        { type: 'module' }
      )
    }
    return this.worker
  }

  private sendMessage<T> (message: WorkerRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = this.initWorker()

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data

        if (response.type === 'error') {
          worker.removeEventListener('message', handleMessage)
          reject(new Error(response.error))
        } else {
          worker.removeEventListener('message', handleMessage)
          resolve(response as T)
        }
      }

      worker.addEventListener('message', handleMessage)
      worker.postMessage(message)
    })
  }

  async loadRepo (owner: string, repo: string, commitSha: string, repoContent: RepoContent): Promise<void> {
    // Check if we already have this repo loaded
    if (
      this.currentRepo &&
      this.currentRepo.owner === owner &&
      this.currentRepo.repo === repo &&
      this.currentRepo.commitSha === commitSha
    ) {
      return
    }

    // Load into worker
    await this.sendMessage<{ type: 'load-complete', success: boolean }>({
      type: 'load',
      payload: repoContent
    })

    this.currentRepo = { owner, repo, commitSha }
  }

  async search (keyword: string, filePattern?: string): Promise<SearchResponse> {
    if (!this.currentRepo) {
      throw new Error('No repository loaded. Call loadRepo() first.')
    }

    const response = await this.sendMessage<{ type: 'search-result', payload: SearchResponse }>({
      type: 'search',
      payload: { keyword, filePattern }
    })

    return response.payload
  }

  async clearRepo (): Promise<void> {
    if (!this.worker) return

    await this.sendMessage<{ type: 'load-complete', success: boolean }>({
      type: 'clear',
      payload: undefined
    })

    this.currentRepo = null
  }

  getCurrentRepo () {
    return this.currentRepo
  }

  destroy (): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.currentRepo = null
  }
}

// Singleton instance
export const repoSearchService = new RepoSearchService()