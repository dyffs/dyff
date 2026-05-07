import GithubCredential from "@/database/github_credential"
import { GithubRepository } from "@/types"
import { createOctokitClient, mapRepository } from "@/service/github"
import { logger } from "@/service/logger"

/**
 * Fetch repositories accessible with the given credential
 * Supports both PAT and GitHub App authentication
 */
async function fetchRepositories(
  credential: GithubCredential,
  options: {
    page?: number
    per_page?: number
    sort?: 'created' | 'updated' | 'pushed' | 'full_name'
    direction?: 'asc' | 'desc'
    affiliation?: string
  } = {}
): Promise<GithubRepository[]> {
  const octokit = await createOctokitClient(credential)

  const {
    page = 1,
    per_page = 100,
    sort = 'updated',
    direction = 'desc',
    affiliation = 'owner,collaborator,organization_member',
  } = options

  try {
    const kind = credential.kind

    if (kind === 'pat') {
      // PAT tokens can call listForAuthenticatedUser directly
      const response = await octokit.rest.repos.listForAuthenticatedUser({
        page,
        per_page,
        sort,
        direction,
        affiliation,
      })

      return response.data.map(mapRepository)
    }

    if (kind === 'github_app_installation' || kind === 'oauth_user') {
      // Installation tokens must use listReposAccessibleToInstallation
      const response = await octokit.rest.apps.listReposAccessibleToInstallation({
        page,
        per_page,
      })

      return response.data.repositories.map(mapRepository)
    }

    throw new Error(`Unsupported credential kind: ${kind}`)
  } catch (error) {
    logger.error('Error fetching repositories from GitHub:', error)
    throw new Error(`Failed to fetch repositories: ${(error as Error).message}`)
  }
}

export async function fetchAllRepositories(
  credential: GithubCredential,
  options: {
    sort?: 'created' | 'updated' | 'pushed' | 'full_name'
    direction?: 'asc' | 'desc'
    affiliation?: string
    delayMs?: number  // delay between requests
  } = {}
): Promise<GithubRepository[]> {
  const allRepos: GithubRepository[] = []
  let page = 1
  const per_page = 100
  const { delayMs = 500, ...fetchOptions } = options

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  while (true) {
    const repos = await fetchRepositories(credential, {
      ...fetchOptions,
      page,
      per_page,
    })

    if (repos.length === 0) {
      break
    }

    allRepos.push(...repos)

    if (repos.length < per_page) {
      break
    }

    page++

    // Wait before next request to avoid rate limiting
    await delay(delayMs)
  }

  return allRepos
}