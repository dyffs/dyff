import apiClient from '@/modules/apiClient'
import type {SerializedRepository } from '@/types'

async function listRepos () {
  const response = await apiClient.get<{
    repositories: SerializedRepository[]
    credential_type: string
    total: number
  }>('/repositories/')
  return response.data
}

async function listTrackedRepos () {
  const response = await apiClient.get<{
    repositories: SerializedRepository[]
    total: number
  }>('/repositories/tracked-repositories')
  return response.data
}

async function trackRepos (repositories: { owner: string, repo: string }[]) {
  const response = await apiClient.post<{
    message: string
    tracked_repositories: SerializedRepository[]
  }>('/repositories/track', { repositories })
  return response.data
}

async function untrackRepo (repoId: string) {
  const response = await apiClient.post<{
    message: string
  }>(`/repositories/${repoId}/untrack`)
  return response.data
}

async function fetchRepoDetails (owner: string, repo: string) {
  const response = await apiClient.get<{
    repository: SerializedRepository
    cached: boolean
  }>(`/repositories/${owner}/${repo}/details`)
  return response.data
}

async function cloneRepo (owner: string, repo: string) {
  const response = await apiClient.post<{
    message: string
    status: 'cloning' | 'cloned'
  }>(`/repositories/${owner}/${repo}/clone`)
  return response.data
}

async function getRepoContent (owner: string, repo: string, commitSha: string) {
  const response = await apiClient.get<{
    content: { filePath: string, content: string }[]
    commit_sha: string
    total_files: number
  }>(`/repositories/${owner}/${repo}/content`, {
    params: { commitSha }
  })
  return response.data
}

export { listRepos, listTrackedRepos, trackRepos, untrackRepo, fetchRepoDetails, cloneRepo, getRepoContent }

