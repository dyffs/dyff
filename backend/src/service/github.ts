import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from "@octokit/rest";
import GithubCredential, { GithubCredentialKind } from '@/database/github_credential'
import {
  GithubRepository,
  GithubPullRequest,
  GithubReview,
  GithubTimelineEvent,
} from '@/types'
import { getInstallationId } from './github_installation'
import { getValidAccessToken } from './github_token'
import { logger } from './logger';

/**
 * Create an authenticated Octokit instance for read operations.
 *
 * - PAT: bearer token directly.
 * - user / organization: GitHub App installation token via createAppAuth.
 *   App credentials (APP_ID, PRIVATE_KEY) come from env; installation_id is
 *   discovered lazily and cached in the credential's JSONB.
 */
export async function createOctokitClient(credential: GithubCredential): Promise<Octokit> {
  const kind = credential.kind

  if (kind === 'pat') {
    return new Octokit({
      auth: credential.access_token,
    })
  }

  if (kind === 'github_app_installation' || kind === 'oauth_user') {
    const appId = process.env.GITHUB_APP_ID
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY

    if (!appId || !privateKey) {
      throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set for GitHub App authentication')
    }

    const installationId = await getInstallationId(credential)

    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey,
        installationId: Number(installationId),
      },
    })
  }

  throw new Error(`Unsupported credential kind: ${kind}`)
}

/**
 * Create an Octokit instance for write operations (posting comments, reviews, etc.).
 *
 * - PAT: same as createOctokitClient (PATs are read+write).
 * - user: uses the OAuth access_token so actions appear as the user on GitHub.
 * - organization: throws — no per-user token is available.
 */
export async function createWriteClient(credential: GithubCredential): Promise<Octokit> {
  const kind = credential.kind

  if (kind === 'pat') {
    return new Octokit({ auth: credential.access_token })
  }
  if (kind === 'oauth_user') {
    const token = await getValidAccessToken(credential)
    return new Octokit({ auth: token })
  }
  throw new Error(
    'createWriteClient is not supported for github_app_installation credentials (no user token available). Use the user\'s OAuth credential instead.'
  )
}

export function mapRepository(repo: any): GithubRepository {
  return {
    id: repo.id,
    node_id: repo.node_id,
    name: repo.name,
    full_name: repo.full_name,
    owner: {
      login: repo.owner.login,
      id: repo.owner.id,
      node_id: repo.owner.node_id,
      avatar_url: repo.owner.avatar_url,
      type: repo.owner.type,
    },
    private: repo.private,
    html_url: repo.html_url,
    description: repo.description,
    created_at: repo.created_at,
    updated_at: repo.updated_at,
    pushed_at: repo.pushed_at,
    visibility: repo.visibility,
    default_branch: repo.default_branch,
    permissions: repo.permissions
  }
}

/**
 * Get specific repositories by owner and repo name
 * Fetches all repositories in parallel for efficiency
 */
export async function getRepositories(
  credential: GithubCredential,
  repos: Array<{ owner: string; repo: string }>
): Promise<GithubRepository[]> {
  const octokit = await createOctokitClient(credential)

  try {
    const promises = repos.map(({ owner, repo }) =>
      octokit.rest.repos.get({ owner, repo })
        .then(response => mapRepository(response.data))
        .catch(error => {
          logger.error(`Error fetching repository ${owner}/${repo}:`, error)
          throw new Error(`Failed to fetch repository ${owner}/${repo}: ${(error as Error).message}`)
        })
    )

    return await Promise.all(promises)
  } catch (error) {
    logger.error('Error fetching repositories:', error)
    throw error
  }
}

/**
 * Fetch pull requests from a repository
 * Sorted by created or updated date (newest first), fetches up to 100 PRs by default
 */
export async function fetchPullRequests(
  credential: GithubCredential,
  owner: string,
  repo: string,
  options: {
    state?: 'open' | 'closed' | 'all'
    sort?: 'created' | 'updated'
    limit?: number
    delayMs?: number
    since?: Date
  } = {}
): Promise<GithubPullRequest[]> {
  const octokit = await createOctokitClient(credential)

  const {
    state = 'all',
    sort = 'created',
    limit = 100,
    delayMs = 500,
    since,
  } = options

  const per_page = 30
  const maxPages = Math.ceil(limit / per_page)
  const allPullRequests: GithubPullRequest[] = []
  const sinceMs = since?.getTime()

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  try {
    for (let page = 1; page <= maxPages; page++) {
      const response = await octokit.rest.pulls.list({
        owner,
        repo,
        state,
        sort,
        direction: 'desc',
        per_page,
        page,
        headers: {
          accept: 'application/vnd.github.full+json'
        }
      })

      if (response.data.length === 0) {
        break
      }

      allPullRequests.push(...response.data as any)

      // Early exit: if sorted by 'updated' desc and any PR in this page is at or
      // before the watermark, every subsequent PR is also unchanged — stop here.
      if (sinceMs !== undefined && sort === 'updated') {
        const hitWatermark = response.data.some(
          pr => new Date(pr.updated_at).getTime() <= sinceMs
        )
        if (hitWatermark) {
          break
        }
      }

      // Stop if we've reached the limit
      if (allPullRequests.length >= limit) {
        break
      }

      // Stop if we got fewer results than per_page (last page)
      if (response.data.length < per_page) {
        break
      }

      // Wait before next request to avoid rate limiting
      if (page < maxPages) {
        await delay(delayMs)
      }
    }

    // Filter out PRs at or before the watermark (already up-to-date in DB)
    const filtered = sinceMs !== undefined
      ? allPullRequests.filter(pr => new Date(pr.updated_at).getTime() > sinceMs)
      : allPullRequests

    // Trim to exact limit
    return filtered.slice(0, limit)
  } catch (error) {
    logger.error(`Error fetching pull requests for ${owner}/${repo}:`, error)
    throw new Error(`Failed to fetch pull requests: ${(error as Error).message}`)
  }
}

/**
 * Get a specific pull request by number
 */
export async function getPullRequest(
  credential: GithubCredential,
  owner: string,
  repo: string,
  pull_number: number
): Promise<GithubPullRequest> {
  const octokit = await createOctokitClient(credential)

  try {
    const response = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number,
      headers: {
        accept: 'application/vnd.github.full+json'
      }
    })

    return response.data as any
  } catch (error) {
    logger.error(`Error fetching pull request ${owner}/${repo}#${pull_number}:`, error)
    throw new Error(`Failed to fetch pull request: ${(error as Error).message}`)
  }
}

/**
 * Get the raw diff for a pull request
 *
 * @param credential - GitHub credential
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param pull_number - Pull request number
 * @returns Raw diff string
 */
export async function getPullRequestDiff(
  credential: GithubCredential,
  owner: string,
  repo: string,
  pull_number: number
): Promise<string> {
  const octokit = await createOctokitClient(credential)

  try {
    const response = await octokit.request(`GET /repos/${owner}/${repo}/pulls/${pull_number}`, {
      owner,
      repo,
      pull_number,
      headers: {
        accept: 'application/vnd.github.v3.diff',
      },
    })

    return response.data as any
  } catch (error) {
    logger.error(`Error fetching diff for ${owner}/${repo}#${pull_number}:`, error)
    throw new Error(`Failed to fetch pull request diff: ${(error as Error).message}`)
  }
}

/**
 * Get all reviews for a pull request
 *
 * @param credential - GitHub credential
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param pull_number - Pull request number
 * @returns Array of reviews
 */
export async function getPullRequestReviews(
  credential: GithubCredential,
  owner: string,
  repo: string,
  pull_number: number
): Promise<GithubReview[]> {
  const octokit = await createOctokitClient(credential)

  try {
    const response = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number,
      per_page: 100,
    })

    return response.data as any
  } catch (error) {
    logger.error(`Error fetching reviews for ${owner}/${repo}#${pull_number}:`, error)
    throw new Error(`Failed to fetch pull request reviews: ${(error as Error).message}`)
  }
}

/**
 * Get timeline events for a pull request
 *
 * @param credential - GitHub credential
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issue_number - Issue/PR number (PRs are issues in GitHub API)
 * @returns Array of timeline events
 */
export async function getPullRequestTimeline(
  credential: GithubCredential,
  owner: string,
  repo: string,
  issue_number: number
): Promise<GithubTimelineEvent[]> {
  const octokit = await createOctokitClient(credential)

  try {
    const response = await octokit.request(`GET /repos/${owner}/${repo}/issues/${issue_number}/timeline`, {
      owner,
      repo,
      issue_number,
      headers: {
        accept: 'application/vnd.github.mockingbird-preview+json',
      },
      per_page: 100,
    })

    return response.data as any
  } catch (error) {
    logger.error(`Error fetching timeline for ${owner}/${repo}#${issue_number}:`, error)
    throw new Error(`Failed to fetch pull request timeline: ${(error as Error).message}`)
  }
}

