import type { SerializedPullRequest, DashboardPR } from '@/types'
import { computeReviewers } from './computeReviewers'
import { getTimeAgo } from '@/lib/utils'

function getStatus (
  serializedPR: SerializedPullRequest,
): 'open' | 'merged' | 'closed' {
  if (serializedPR.github_status === 'closed') {
    if (serializedPR.github_merged_at) {
      return 'merged'
    }
    return 'closed'
  }

  return 'open'
}

export function transformPRData (serializedPR: SerializedPullRequest, owner: string, repo: string): DashboardPR {
  const status = getStatus(serializedPR)

  // Transform reviewers
  const reviewers = computeReviewers(serializedPR)

  // 1 day
  const isNew = serializedPR.github_created_at > new Date(Date.now() - 1000 * 60 * 60 * 24)

  return {
    owner,
    repo,
    pr_number: serializedPR.github_pr_number,
    title: serializedPR.title,
    author: serializedPR.author_github_username || serializedPR.author_id, // This might need to be transformed to username
    branch: serializedPR.head_branch,
    baseBranch: serializedPR.base_branch,
    status,
    reviewers,
    isNew,
    isDraft: serializedPR.meta.draft,
    mergedAt: status === 'merged' ? getTimeAgo(serializedPR.github_merged_at) : undefined,
    updatedAt: getTimeAgo(serializedPR.github_updated_at),
    updatedAtRaw: new Date(serializedPR.github_updated_at),
  }
}