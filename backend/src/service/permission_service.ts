/**
 * Permission Service
 *
 * Handles permission checking for various resources (repositories, pull requests, etc.)
 */

import PullRequest from '@/database/pull_request'
import Repository from '@/database/repository'
import RepositoryTracking from '@/database/repository_tracking'
import User from '@/database/user'
import { cpSync } from 'node:fs'
import { Op } from 'sequelize'

/**
 * Check if a user has access to a repository
 *
 * @param userId - The user ID to check
 * @param repositoryId - The repository ID to check
 * @returns true if user has access, false otherwise
 */
export async function hasRepositoryAccess(
  userId: string,
  repositoryId: string
): Promise<boolean> {
  const user = await User.findByPk(userId)
  if (!user) {
    return false
  }

  const tracking = await RepositoryTracking.findOne({
    where: {
      repository_id: repositoryId,
      [Op.or]: [
        { tracking_type: 'user', tracking_id: userId },
        { tracking_type: 'team', tracking_id: user.team_id },
      ],
    },
  })

  return !!tracking
}

/**
 * Check if a user has access to a pull request
 *
 * Access is determined by checking if the user has access to the repository
 * that the pull request belongs to.
 *
 * @param userId - The user ID to check
 * @param pullRequestId - The pull request ID to check
 * @returns Object with hasAccess flag and optional pullRequest/repository data
 */
export async function hasPullRequestAccess(
  userId: string,
  pullRequestId: string
): Promise<{
  hasAccess: boolean
  pullRequest?: PullRequest
  repository?: Repository
}> {
  // Find the pull request
  const pullRequest = await PullRequest.findByPk(pullRequestId)
  if (!pullRequest) {
    return { hasAccess: false }
  }

  // Find the repository
  const repository = await Repository.findByPk(pullRequest.repository_id)
  if (!repository) {
    return { hasAccess: false }
  }

  // Check repository access
  const hasAccess = await hasRepositoryAccess(userId, repository.id)

  return {
    hasAccess,
    pullRequest: hasAccess ? pullRequest : undefined,
    repository: hasAccess ? repository : undefined,
  }
}

/**
 * Assert that a user has access to a pull request
 * Throws an error if access is denied
 *
 * @param userId - The user ID to check
 * @param pullRequestId - The pull request ID to check
 * @returns Object with pullRequest and repository data
 * @throws Error if access is denied or resources not found
 */
export async function assertPullRequestAccess(
  userId: string,
  pullRequestId: string
): Promise<{
  pullRequest: PullRequest
  repository: Repository
}> {
  const result = await hasPullRequestAccess(userId, pullRequestId)

  if (!result.hasAccess) {
    throw new Error('Access denied or resource not found')
  }

  if (!result.pullRequest || !result.repository) {
    throw new Error('Unexpected error: missing data after access check')
  }

  return {
    pullRequest: result.pullRequest,
    repository: result.repository,
  }
}

/**
 * Check if a user has access to a repository by owner/repo
 *
 * @param userId - The user ID to check
 * @param owner - Repository owner (GitHub username or org)
 * @param repo - Repository name
 * @returns Object with hasAccess flag and optional repository data
 */
export async function hasRepositoryAccessByOwnerRepo(
  userId: string,
  owner: string,
  repo: string
): Promise<{
  hasAccess: boolean
  repository?: Repository
}> {
  // Find the repository
  const repository = await Repository.findOne({
    where: {
      github_owner: owner,
      github_repo: repo,
    },
  })

  if (!repository) {
    return { hasAccess: false }
  }

  // Check repository access
  const hasAccess = await hasRepositoryAccess(userId, repository.id)

  return {
    hasAccess,
    repository: hasAccess ? repository : undefined,
  }
}

/**
 * Assert that a user has access to a repository by owner/repo
 * Throws an error if access is denied
 *
 * @param userId - The user ID to check
 * @param owner - Repository owner (GitHub username or org)
 * @param repo - Repository name
 * @returns Repository data
 * @throws Error if access is denied or repository not found
 */
export async function assertRepositoryAccessByOwnerRepo(
  userId: string,
  owner: string,
  repo: string
): Promise<Repository> {
  const result = await hasRepositoryAccessByOwnerRepo(userId, owner, repo)

  if (!result.hasAccess || !result.repository) {
    throw new Error('Repository not found or access denied')
  }

  return result.repository
}
