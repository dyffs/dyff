import { requestContext } from '@/service/requestContext'
import { setLastFetchForRepo } from '@/service/cache_service'
import { Request, Response } from 'express'
import express from 'express'
import PullRequest from '@/database/pull_request'
import PullRequestDiff from '@/database/pull_request_diff'
import {
  fetchPullRequests,
  getPullRequest,
  getPullRequestDiff,
  getPullRequestReviews,
  getPullRequestTimeline
} from '@/service/github'
import { findOrCreateUsersByGithubUsername } from '@/service/user_service'
import {
  assertPullRequestAccess,
  assertRepositoryAccessByOwnerRepo,
} from '@/service/permission_service'
import { serializePullRequests, serializePullRequest } from '@/serializer/pull_request'
import { StoredReview, StoredTimelineEvent } from '@/types'
import { reverse } from 'lodash'
import { syncGithubCommentsToComments } from '@/module/comment/sync_to_comments'
import { fetchGithubComments } from '@/module/comment/fetch_github_comments'
import { getReadCredential, CredentialNotFoundError } from '@/service/github_credential_service'
import { logger } from '@/service/logger'
import { syncGithubComments } from '@/module/comment/sync_github_comments'
import { fetchAndUpdate } from '@/service/git'

const router = express.Router()

function credentialErrorResponse(res: Response, err: CredentialNotFoundError) {
  return res.status(404).json({ error: err.message, code: err.code })
}


router.get('/:id/diff', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { id } = req.params

    // Check permission: pull request -> repository -> repository tracking
    const { pullRequest, repository } = await assertPullRequestAccess(
      user.id,
      id
    )

    const credential = await getReadCredential(user)

    // Fetch current PR details from GitHub to get the latest commit SHA
    const githubPR = await getPullRequest(
      credential,
      repository.github_owner,
      repository.github_repo,
      pullRequest.github_pr_number
    )

    const currentCommitSha = githubPR.head.sha

    // Check if we already have the diff stored
    const existingDiff = await PullRequestDiff.findOne({
      where: {
        pull_request_id: pullRequest.id,
      },
    })

    // If cached diff exists and commit SHA matches, return cached
    if (existingDiff && existingDiff.head_commit_sha === currentCommitSha) {
      return res.status(200).json({
        diff: existingDiff.raw_diff,
        head_commit_sha: existingDiff.head_commit_sha,
      })
    }

    // Fetch fresh diff from GitHub
    const rawDiff = await getPullRequestDiff(
      credential,
      repository.github_owner,
      repository.github_repo,
      pullRequest.github_pr_number
    )

    // Update or create the diff
    let storedDiff: PullRequestDiff
    if (existingDiff) {
      // Update existing diff
      existingDiff.raw_diff = rawDiff
      existingDiff.head_commit_sha = currentCommitSha
      await existingDiff.save()
      storedDiff = existingDiff
    } else {
      // Create new diff
      storedDiff = await PullRequestDiff.create({
        pull_request_id: pullRequest.id,
        head_commit_sha: currentCommitSha,
        raw_diff: rawDiff,
      })
    }

    return res.status(200).json({
      diff: storedDiff.raw_diff,
      head_commit_sha: storedDiff.head_commit_sha,
    })
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return credentialErrorResponse(res, error)
    }
    logger.error('Error fetching pull request diff:', error)

    if ((error as Error).message === 'Access denied or resource not found') {
      return res.status(403).json({
        error: 'Access denied or pull request not found'
      })
    }

    return res.status(500).json({
      error: 'Failed to fetch pull request diff',
      message: (error as Error).message,
    })
  }
})

router.get('/:id/details', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { id } = req.params

    // Check permission: pull request -> repository -> repository tracking
    const { pullRequest, repository } = await assertPullRequestAccess(user.id, id)

    // Pull request is already up to date through fetching the list of PRs
    if (pullRequest.up_to_date) {
      return res.status(200).json({
        pull_request: await serializePullRequest(pullRequest, { includeComments: true }),
      })
    }

    const credential = await getReadCredential(user)

    // Fetch reviews from GitHub
    const githubReviews = await getPullRequestReviews(
      credential,
      repository.github_owner,
      repository.github_repo,
      pullRequest.github_pr_number
    )

    // Transform reviews to StoredReview format
    const storedReviews: StoredReview[] = githubReviews.map(review => ({
      id: review.id,
      user_login: review.user.login,
      state: review.state,
      submitted_at: review.submitted_at,
      commit_id: review.commit_id,
    }))

    // Fetch timeline events from GitHub
    const githubTimeline = await getPullRequestTimeline(
      credential,
      repository.github_owner,
      repository.github_repo,
      pullRequest.github_pr_number
    )

    // Transform timeline events to StoredTimelineEvent format
    const storedEvents: StoredTimelineEvent[] = githubTimeline.map(event => ({
      event: event.event,
      updated_at: event.updated_at || null,
      submitted_at: event.submitted_at || null,
      created_at: event.created_at || null,
      actor_login: event.actor?.login || null,
      user_login: event.user?.login || null,
      commit_id: event.commit_id || null,
      label_name: event.label?.name || null,
      assignee_login: event.assignee?.login || null,
      reviewer_login: event.requested_reviewer?.login || null,
      state: event.state || null,
    }))

    await syncGithubComments(credential, pullRequest, user, repository)

    // Update the pull request with reviews and timeline
    await pullRequest.update({
      review_rounds: { reviews: storedReviews },
      timeline: { events: storedEvents },
      up_to_date: true, // Mark as up to date after fetching details
    })

    // Reload to get updated data
    await pullRequest.reload()

    const serializedPR = await serializePullRequest(pullRequest, { includeComments: true })

    // We grab the diff via github API, so here we can simply refresh the repo without waiting it
    // TODO: Still, this is a bad design
    if (repository.status === 'cloned') {
      fetchAndUpdate(credential, repository)
    }

    return res.status(200).json({
      pull_request: serializedPR,
    })
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return credentialErrorResponse(res, error)
    }
    logger.error('Error fetching pull request details:', error)

    if ((error as Error).message === 'Access denied or resource not found') {
      return res.status(403).json({
        error: 'Access denied or pull request not found'
      })
    }

    return res.status(500).json({
      error: 'Failed to fetch pull request details',
      message: (error as Error).message,
    })
  }
})

// List PRs for a repository
router.get('/:owner/:repo', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { owner, repo } = req.params

    // Check permission using the permission service
    const repository = await assertRepositoryAccessByOwnerRepo(
      user.id,
      owner,
      repo
    )

    const credential = await getReadCredential(user)

    // Watermark = newest github_updated_at we already have for this repo.
    // fetchPullRequests will stop paginating once it hits a PR at/before this point.
    const watermarkRow = await PullRequest.findOne({
      where: { repository_id: repository.id },
      order: [['github_updated_at', 'DESC']],
      attributes: ['github_updated_at'],
    })
    const since = watermarkRow?.github_updated_at ?? undefined

    // Fetch only PRs updated since the watermark (cold start: up to 100).
    const githubPRs = await fetchPullRequests(credential, owner, repo, {
      state: 'all',
      sort: 'updated',
      limit: 100,
      since,
    })

    // Find or create users for all PR authors
    const authorUsernames = [...new Set(githubPRs.map(pr => pr.user.login))]
    const userMetadata = new Map(
      githubPRs.map(pr => [pr.user.login, { type: pr.user.type }])
    )
    const userMap = await findOrCreateUsersByGithubUsername(authorUsernames, user.team_id, userMetadata)

    // Query existing PRs from database for comparison
    const githubPRNumbers = githubPRs.map(pr => pr.number)
    const existingPRs = await PullRequest.findAll({
      where: {
        repository_id: repository.id,
        github_pr_number: githubPRNumbers,
      },
    })

    // Create a map of existing PRs by github_pr_number for quick lookup
    const existingPRMap = new Map(
      existingPRs.map(pr => [pr.github_pr_number, pr])
    )

    for (const githubPR of reverse(githubPRs)) {
      // Get author from the map
      const author = userMap.get(githubPR.user.login)
      if (!author) {
        logger.error(`Failed to find or create user for ${githubPR.user.login}`)
        continue
      }

      // Check if this PR already exists in database
      const existingPR = existingPRMap.get(githubPR.number)
      const githubUpdatedAt = new Date(githubPR.updated_at)

      // Safety: skip if DB already has this exact updated_at (shouldn't happen
      // since fetchPullRequests filters by `since`, but guard against duplicates).
      if (existingPR && existingPR.github_updated_at >= githubUpdatedAt) {
        continue
      }

      // Determine GitHub status
      let github_status: 'open' | 'closed' | 'merged'
      if (githubPR.merged) {
        github_status = 'merged'
      } else if (githubPR.state === 'closed') {
        github_status = 'closed'
      } else {
        github_status = 'open'
      }

      // Extract reviewer usernames
      const reviewerUsernames = githubPR.requested_reviewers.map(r => r.login)

      // Prepare GitHub-sourced fields (fields that come from GitHub API)
      const githubFields = {
        repository_id: repository.id,
        author_id: author.id,
        github_pr_id: githubPR.id,
        github_pr_number: githubPR.number,
        reviewers: {
          github_usernames: reviewerUsernames,
        },
        github_url: githubPR.html_url,
        title: githubPR.title,
        description: githubPR.body,
        html_description: githubPR.body_html,
        github_status,
        base_branch: githubPR.base.ref,
        head_branch: githubPR.head.ref,
        head_commit_sha: githubPR.head.sha,
        github_created_at: new Date(githubPR.created_at),
        github_updated_at: githubUpdatedAt,
        github_merged_at: githubPR.merged_at ? new Date(githubPR.merged_at) : null,
        meta: {
          draft: githubPR.draft,
        },
      }

      if (!existingPR) {
        // Create new PR with default Dyff-specific fields
        await PullRequest.create({
          ...githubFields,
          dyff_status: 'tracked', // Default status for new PRs
          review_rounds: { reviews: [] },
          timeline: { events: [] },
          up_to_date: false, // Mark as not up to date since we need to fetch details
        })
      } else {
        // Update existing PR - only update GitHub-sourced fields and up_to_date flag
        // Preserve Dyff-specific fields (dyff_status, review_rounds, timeline)
        await existingPR.update({
          ...githubFields,
          up_to_date: false, // Mark as not up to date since we need to fetch details
        })
      }
    }

    // Set the last fetch time for this repository
    await setLastFetchForRepo(repository.id, new Date())

    // Return the full top-100 list from DB so unchanged PRs (skipped by early-exit)
    // are still included in the response.
    const allPRs = await PullRequest.findAll({
      where: { repository_id: repository.id },
      attributes: { exclude: ['html_description'] },
      order: [['updated_at', 'DESC']],
      limit: 100,
    })

    const serializedPRs = await serializePullRequests(allPRs)

    return res.status(200).json({
      pull_requests: serializedPRs,
    })
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return credentialErrorResponse(res, error)
    }
    logger.error('Error fetching pull requests:', error)

    if ((error as Error).message === 'Repository not found or access denied') {
      return res.status(403).json({
        error: 'Repository not found or you do not have access to this repository'
      })
    }

    return res.status(500).json({
      error: 'Failed to fetch pull requests',
      message: (error as Error).message,
    })
  }
})

export default router
