import { requestContext } from '@/service/requestContext'
import { Request, Response } from 'express'
import express from 'express'
import { getRepositories } from '@/service/github'
import { fetchAllRepositories } from '@/service/github/fetchAllRepositories'
import Repository from '@/database/repository'
import RepositoryTracking from '@/database/repository_tracking'
import { getRepositoryContent, deleteRepositoryFromDisk } from '@/service/git'
import { initRepo } from '@/service/init_repo'
import { getDb } from '@/database/db'
import { assertRepositoryAccessByOwnerRepo } from '@/service/permission_service'
import { serializeRepositories } from '@/serializer/repository'
import { Op } from 'sequelize'
import path from 'path'
import { logger } from '@/service/logger'
import { getReadCredential, CredentialNotFoundError } from '@/service/github_credential_service'
import { serializeRepository } from '@/serializer/repository'

const router = express.Router()

function credentialErrorResponse(res: Response, err: CredentialNotFoundError) {
  return res.status(404).json({
    error: err.message,
    code: err.code,
  })
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()

    const credential = await getReadCredential(user)

    // Fetch repositories from GitHub
    const repositories = await fetchAllRepositories(credential, {
      sort: 'updated',
      direction: 'desc',
    })

    const serializedRepositories = repositories.map((r) => {
      return serializeRepository(
        new Repository({
          id: r.id,
          github_owner: r.owner.login,
          github_repo: r.name,
          tracking_branch: r.default_branch,
          storage_path: '',
          status: 'new',
          owner_type: r.owner.type === 'User' ? 'user' : 'organization',
          last_fetched_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        })
      )
    })

    return res.status(200).json({
      repositories: serializedRepositories,
      credential_type: credential.kind,
      total: repositories.length,
    })
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return credentialErrorResponse(res, error)
    }
    logger.error('Error fetching repositories:', error)
    return res.status(500).json({
      error: 'Failed to fetch repositories',
      message: (error as Error).message,
    })
  }
})

router.post('/:id/untrack', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { id } = req.params

    const repository = await Repository.findByPk(id)
    if (!repository) {
      return res.status(404).json({
        error: 'Repository not found'
      })
    }

    await assertRepositoryAccessByOwnerRepo(user.id, repository.github_owner, repository.github_repo)

    await getDb().transaction(async (tx) => {
      await RepositoryTracking.destroy({
        where: { repository_id: id },
        transaction: tx,
      })

      await repository.destroy({ transaction: tx })
      await deleteRepositoryFromDisk(repository)
    })

    return res.status(200).json({
      message: 'Repository untracked successfully'
    })
  } catch (error) {
    logger.error('Error untracking repository:', error)
    return res.status(500).json({
      error: 'Failed to untrack repository',
      message: (error as Error).message,
    })
  }
})

router.get('/tracked-repositories', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()

    // Find all repository trackings for this user or their team
    // Query: (user.id == tracking_id AND tracking_type == 'user') OR (user.team_id == tracking_id AND tracking_type == 'team')
    const trackings = await RepositoryTracking.findAll({
      where: {
        [Op.or]: [
          { tracking_type: 'user', tracking_id: user.id },
          { tracking_type: 'team', tracking_id: user.team_id },
        ],
      },
    })

    if (trackings.length === 0) {
      return res.status(200).json({
        repositories: [],
        total: 0,
      })
    }

    // Get unique repository IDs
    const repositoryIds = [...new Set(trackings.map(t => t.repository_id))]

    // Fetch repository records from database
    const repositories = await Repository.findAll({
      where: {
        id: repositoryIds,
      },
      order: [['updated_at', 'DESC']],
    })

    // Serialize repositories for client
    const serializedRepos = serializeRepositories(repositories)

    return res.status(200).json({
      repositories: serializedRepos,
      total: serializedRepos.length,
    })
  } catch (error) {
    logger.error('Error fetching tracked repositories:', error)
    return res.status(500).json({
      error: 'Failed to fetch tracked repositories',
      message: (error as Error).message,
    })
  }
})

router.post('/track', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { repositories } = req.body

    if (!repositories || !Array.isArray(repositories) || repositories.length === 0) {
      return res.status(400).json({
        error: 'repositories is required and must be a non-empty array of { owner, repo } objects'
      })
    }

    if (repositories.length > 10) {
      return res.status(400).json({
        error: 'Cannot track more than 10 repositories at once'
      })
    }

    // Validate repository filters
    for (const repo of repositories) {
      if (!repo.owner || !repo.repo) {
        return res.status(400).json({
          error: 'Each repository must have both owner and repo fields'
        })
      }
    }

    const credential = await getReadCredential(user)

    // Fetch repository details from GitHub to verify access
    const githubRepos = await getRepositories(credential, repositories)

    // Process each repository
    for (const githubRepo of githubRepos) {
      // Determine tracking type based on repository owner type
      let trackingType: 'user' | 'team'
      let trackingId: string
      let ownerType: 'user' | 'organization'

      if (githubRepo.owner.type === 'User') {
        trackingType = 'user'
        trackingId = user.id
        ownerType = 'user'
      } else if (githubRepo.owner.type === 'Organization') {
        trackingType = 'team'
        trackingId = user.team_id
        ownerType = 'organization'
      } else {
        // Skip Bot-owned repositories
        logger.warn(`Skipping repository ${githubRepo.full_name} with owner type: ${githubRepo.owner.type}`)
        continue
      }

      // Create or update repository record
      const [repository] = await Repository.findOrCreate({
        where: {
          github_owner: githubRepo.owner.login,
          github_repo: githubRepo.name,
        },
        defaults: {
          github_owner: githubRepo.owner.login,
          github_repo: githubRepo.name,
          tracking_branch: githubRepo.default_branch,
          storage_path: path.join('repositories', githubRepo.owner.login, githubRepo.name),
          last_fetched_at: new Date(),
          owner_type: ownerType,
        },
      })

      // Update tracking branch / owner_type if changed
      if (
        repository.tracking_branch !== githubRepo.default_branch ||
        repository.owner_type !== ownerType
      ) {
        repository.tracking_branch = githubRepo.default_branch
        repository.owner_type = ownerType
        repository.last_fetched_at = new Date()
        await repository.save()
      }

      // Create repository tracking record
      const [, created] = await RepositoryTracking.findOrCreate({
        where: {
          repository_id: repository.id,
          tracking_type: trackingType,
          tracking_id: trackingId,
        },
        defaults: {
          repository_id: repository.id,
          tracking_type: trackingType,
          tracking_id: trackingId,
        },
      })
    }

    // Fetch all tracked repositories for this user
    // Query: (user.id == tracking_id AND tracking_type == 'user') OR (user.team_id == tracking_id AND tracking_type == 'team')
    const trackings = await RepositoryTracking.findAll({
      where: {
        [Op.or]: [
          { tracking_type: 'user', tracking_id: user.id },
          { tracking_type: 'team', tracking_id: user.team_id },
        ],
      },
    })

    // Get unique repository IDs
    const repositoryIds = [...new Set(trackings.map(t => t.repository_id))]

    // Fetch repository records from database
    const trackedRepos = await Repository.findAll({
      where: {
        id: repositoryIds,
      },
      order: [['updated_at', 'DESC']],
    })

    return res.status(200).json({
      message: 'Repositories tracked successfully',
      tracked_repositories: serializeRepositories(trackedRepos),
    })
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return credentialErrorResponse(res, error)
    }
    logger.error('Error tracking repositories:', error)
    return res.status(500).json({
      error: 'Failed to track repositories',
      message: (error as Error).message,
    })
  }
})

router.get('/:owner/:repo/details', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { owner, repo } = req.params

    // Check if we have a cached repository
    const cachedRepo = await Repository.findOne({
      where: {
        github_owner: owner,
        github_repo: repo,
      },
    })

    // Return cached data if fetched within last 5 minutes
    const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes
    if (cachedRepo?.last_fetched_at) {
      const timeSinceLastFetch = Date.now() - cachedRepo.last_fetched_at.getTime()
      if (timeSinceLastFetch < CACHE_DURATION_MS) {
        const serializedRepo = serializeRepositories([cachedRepo])[0]
        return res.status(200).json({
          repository: serializedRepo,
          cached: true,
        })
      }
    }

    const credential = await getReadCredential(user)

    // Fetch repository details from GitHub
    const githubRepos = await getRepositories(credential, [{ owner, repo }])

    if (githubRepos.length === 0) {
      return res.status(404).json({
        error: 'Repository not found or you do not have access to this repository on GitHub'
      })
    }

    const githubRepo = githubRepos[0]

    let ownerType: 'user' | 'organization' | undefined
    if (githubRepo.owner.type === 'User') {
      ownerType = 'user'
    } else if (githubRepo.owner.type === 'Organization') {
      ownerType = 'organization'
    }

    // Find or create repository in database
    const [repository] = await Repository.findOrCreate({
      where: {
        github_owner: githubRepo.owner.login,
        github_repo: githubRepo.name,
      },
      defaults: {
        github_owner: githubRepo.owner.login,
        github_repo: githubRepo.name,
        tracking_branch: githubRepo.default_branch,
        storage_path: path.join('repositories', githubRepo.owner.login, githubRepo.name),
        last_fetched_at: new Date(),
        owner_type: ownerType,
      },
    })

    // Update repository with latest data from GitHub
    repository.tracking_branch = githubRepo.default_branch
    if (ownerType) {
      repository.owner_type = ownerType
    }
    repository.last_fetched_at = new Date()
    await repository.save()

    // Serialize and return repository
    const serializedRepo = serializeRepositories([repository])[0]

    return res.status(200).json({
      repository: serializedRepo,
      cached: false,
    })
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return credentialErrorResponse(res, error)
    }
    logger.error('Error fetching repository details:', error)

    if ((error as Error).message.includes('Failed to fetch repository')) {
      return res.status(404).json({
        error: 'Repository not found or you do not have access to this repository on GitHub',
        message: (error as Error).message,
      })
    }

    return res.status(500).json({
      error: 'Failed to fetch repository details',
      message: (error as Error).message,
    })
  }
})

router.post('/:owner/:repo/clone', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { owner, repo } = req.params

    // Check permission - repository must exist in database and user must have access
    const repository = await assertRepositoryAccessByOwnerRepo(user.id, owner, repo)

    const credential = await getReadCredential(user)

    // Check if clone operation can run
    const currentStatus = repository.status || 'new'
    if (currentStatus === 'cloning') {
      return res.status(400).json({
        error: 'Repository is already being cloned',
        status: currentStatus,
      })
    }

    if (currentStatus === 'cloned') {
      return res.status(200).json({
        message: 'Repository is already cloned',
        status: currentStatus,
      })
    }

    // Update status to 'cloning'
    repository.status = 'cloning'
    await repository.save()

    await initRepo(credential, repository)

    // Return immediately with cloning status
    return res.status(202).json({
      message: 'Repository clone operation started',
      status: 'cloning',
    })
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return credentialErrorResponse(res, error)
    }
    logger.error('Error starting repository clone:', error)

    if ((error as Error).message === 'Repository not found or access denied') {
      return res.status(403).json({
        error: 'Repository not found or you do not have access to this repository. Please track it first using POST /api/repositories/track.'
      })
    }

    return res.status(500).json({
      error: 'Failed to start repository clone',
      message: (error as Error).message,
    })
  }
})

router.get('/:owner/:repo/content', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { owner, repo } = req.params
    const { commitSha } = req.query

    if (!commitSha || typeof commitSha !== 'string') {
      return res.status(400).json({
        error: 'commitSha query parameter is required'
      })
    }

    // Check permission using the permission service
    const repository = await assertRepositoryAccessByOwnerRepo(
      user.id,
      owner,
      repo
    )

    const credential = await getReadCredential(user)

    // Get repository content at the specified commit
    // This will automatically fetch updates if the commit is not found locally
    const files = await getRepositoryContent(
      credential,
      repository,
      commitSha,
      {
        includeBinary: false, // Don't include binary content by default
        maxFileSize: 10 * 1024 * 1024, // 10MB max
      }
    )

    // Transform to the requested format
    const content = files.map(file => ({
      filePath: file.path,
      content: file.content,
    }))

    return res.status(200).json({
      content,
      commit_sha: commitSha,
      total_files: content.length,
    })
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return credentialErrorResponse(res, error)
    }
    logger.error('Error fetching repository content:', error)

    if ((error as Error).message === 'Repository not found or access denied') {
      return res.status(403).json({
        error: 'Repository not found or you do not have access to this repository. Please track it first.'
      })
    }

    if ((error as Error).message.includes('Commit') && (error as Error).message.includes('not found')) {
      return res.status(404).json({
        error: 'Commit not found',
        message: (error as Error).message,
      })
    }

    return res.status(500).json({
      error: 'Failed to fetch repository content',
      message: (error as Error).message,
    })
  }
})

export default router