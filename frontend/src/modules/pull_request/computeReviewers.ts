import type { SerializedPullRequest } from '@/types'

export function computeReviewers (serializedPR: SerializedPullRequest): string[] {
  return serializedPR.reviewers.github_usernames
}