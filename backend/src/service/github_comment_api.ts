/**
 * GitHub Comment API Service
 *
 * Provides functions to fetch comments from GitHub pull requests.
 */

import GithubCredential from '@/database/github_credential'
import { GithubReviewComment, GithubIssueComment } from '@/types'
import { createOctokitClient, createWriteClient } from './github'
import { logger } from './logger'
import { Comment } from '@/module/comment/types'

/**
 * Get all review comments (comments on code) for a pull request
 */
export async function getPullRequestReviewComments(
  credential: GithubCredential,
  owner: string,
  repo: string,
  pull_number: number,
  options: {
    limit?: number
    per_page?: number
    delayMs?: number
    // ISO 8601. When set, GitHub returns only comments updated at or after this time.
    since?: string
    // Defaults to 'updated' / 'asc' so paginating with `since` is stable.
    sort?: 'created' | 'updated'
    direction?: 'asc' | 'desc'
  } = {}
): Promise<GithubReviewComment[]> {
  const octokit = await createOctokitClient(credential)

  const {
    limit = 200,
    per_page = 50,
    delayMs = 500,
    since,
    sort = 'updated',
    direction = 'asc',
  } = options

  const maxPages = Math.ceil(limit / per_page)
  const allComments: GithubReviewComment[] = []

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  try {
    for (let page = 1; page <= maxPages; page++) {
      const response = await octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number,
        per_page,
        page,
        sort,
        direction,
        ...(since && { since }),
      })

      if (response.data.length === 0) {
        break
      }

      allComments.push(...response.data as any)

      if (allComments.length >= limit) {
        break
      }

      if (response.data.length < per_page) {
        break
      }

      if (page < maxPages) {
        await delay(delayMs)
      }
    }

    return allComments.slice(0, limit)
  } catch (error) {
    logger.error(`Error fetching review comments for ${owner}/${repo}#${pull_number}:`, error)
    throw new Error(`Failed to fetch review comments: ${(error as Error).message}`)
  }
}

/**
 * Get all issue comments (general comments) for a pull request
 * Note: PRs are also issues in GitHub's API
 *
 */
export async function getPullRequestIssueComments(
  credential: GithubCredential,
  owner: string,
  repo: string,
  issue_number: number,
  options: {
    limit?: number
    per_page?: number
    delayMs?: number
    // ISO 8601. When set, GitHub returns only comments updated at or after this time.
    since?: string
  } = {}
): Promise<GithubIssueComment[]> {
  const octokit = await createOctokitClient(credential)

  const {
    limit = 200,
    per_page = 50,
    delayMs = 500,
    since,
  } = options

  const maxPages = Math.ceil(limit / per_page)
  const allComments: GithubIssueComment[] = []

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  try {
    for (let page = 1; page <= maxPages; page++) {
      const response = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number,
        per_page,
        page,
        ...(since && { since }),
      })

      if (response.data.length === 0) {
        break
      }

      allComments.push(...response.data as any)

      if (allComments.length >= limit) {
        break
      }

      if (response.data.length < per_page) {
        break
      }

      if (page < maxPages) {
        await delay(delayMs)
      }
    }

    return allComments.slice(0, limit)
  } catch (error) {
    logger.error(`Error fetching issue comments for ${owner}/${repo}#${issue_number}:`, error)
    throw new Error(`Failed to fetch issue comments: ${(error as Error).message}`)
  }
}

/**
 * Submit a pull request review to GitHub with inline code comments.
 */
export async function submitPullRequestReview(
  credential: GithubCredential,
  owner: string,
  repo: string,
  pull_number: number,
  review: {
    body: string | null
    commit_id: string
    event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES'
    inlineComments: Array<{
      path: string
      body: string
      line: number
      side: 'LEFT' | 'RIGHT'
      start_line?: number
      start_side?: 'LEFT' | 'RIGHT'
    }>
  }
): Promise<{ github_review_id: string }> {
  const octokit = await createWriteClient(credential)

  try {
    const { data: reviewData } = await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number,
      body: review.body || '',
      commit_id: review.commit_id,
      event: review.event,
      comments: review.inlineComments,
    })

    return { github_review_id: String(reviewData.id) }
  } catch (error) {
    logger.error(`Error submitting review for ${owner}/${repo}#${pull_number}:`, error)
    throw new Error(`Failed to submit pull request review: ${(error as Error).message}`)
  }
}

/**
 * Create a standalone comment on a pull request diff line.
 * This is equivalent to clicking a diff line in GitHub and commenting
 * without starting a formal review.
 */
export async function createDiffComment(
  credential: GithubCredential,
  owner: string,
  repo: string,
  pull_number: number,
  params: {
    body: string
    commit_id: string
    code_anchor: NonNullable<Comment['code_anchor']>
  }
): Promise<any> {
  const octokit = await createWriteClient(credential)

  try {
    const isMultiline = params.code_anchor.line_start !== params.code_anchor.line_end

    const { data } = await octokit.rest.pulls.createReviewComment({
      owner,
      repo,
      pull_number,
      body: params.body,
      commit_id: params.commit_id,
      path: params.code_anchor.file_path,
      line: params.code_anchor.line_end,
      side: params.code_anchor.side,
      ...(isMultiline && {
        start_line: params.code_anchor.line_start,
      }),
    })

    return data
  } catch (error) {
    logger.error(`Error creating diff comment for ${owner}/${repo}#${pull_number}:`, error)
    throw new Error(`Failed to create diff comment: ${(error as Error).message}`)
  }
}

/**
 * Post a reply directly into an existing GitHub review comment thread.
 * This is a fire-and-forget write — no draft or review round involved.
 */
export async function replyToComment(
  credential: GithubCredential,
  pull_number: number,
  owner: string,
  repo: string,
  commentId: string,
  body: string
): Promise<any> {
  const octokit = await createWriteClient(credential)

  try {
    const response = await octokit.request(`POST /repos/${owner}/${repo}/pulls/${pull_number}/comments/${commentId}/replies`, {
      body,
    })

    return response.data
  } catch (error) {
    logger.error(`Error replying to comment ${commentId} in ${owner}/${repo}:`, error)
    throw new Error(`Failed to reply to comment: ${(error as Error).message}`)
  }
}
