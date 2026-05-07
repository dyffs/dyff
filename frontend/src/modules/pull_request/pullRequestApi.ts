import apiClient from '@/modules/apiClient'
import type { SerializedPullRequest } from '@/types'
import { convertDate } from '@/lib/utils'

const DATE_KEYS = [
  'github_created_at',
  'github_updated_at',
  'github_merged_at',
  'created_at',
  'updated_at',
]

async function listPullRequests (owner: string, repo: string): Promise<SerializedPullRequest[]> {
  const response = await apiClient.get<{
    pull_requests: SerializedPullRequest[]
  }>(`/pull_requests/${owner}/${repo}`)

  const prs = response.data.pull_requests.map(pr => convertDate(pr, DATE_KEYS))

  return prs as SerializedPullRequest[]
}

async function getPullRequestDetails (id: string): Promise<SerializedPullRequest> {
  const response = await apiClient.get<{
    pull_request: SerializedPullRequest
  }>(`/pull_requests/${id}/details`)
  const pr = convertDate(response.data.pull_request, DATE_KEYS)

  return pr as SerializedPullRequest
}

async function getPullRequestDiff (id: string): Promise<{ diff: string, head_commit_sha: string }> {
  const response = await apiClient.get<{
    diff: string
    head_commit_sha: string
  }>(`/pull_requests/${id}/diff`)
  return response.data
}

export { listPullRequests, getPullRequestDetails, getPullRequestDiff }
