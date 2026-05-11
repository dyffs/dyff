/**
 * Git Service
 *
 * Handles local git operations for tracked repositories using simple-git
 *
 * Features:
 * - Clone repositories to local storage
 * - Fetch and update to latest commit on tracking branch
 * - Read repository contents
 *
 * Storage structure:
 * GIT_DATA_PATH/{storage_path}/
 *   └── .git/
 *   └── ... (repository files)
 *
 * The storage_path is defined in the Repository model and typically follows:
 * {owner}/{repo} or any custom path structure
 */

import simpleGit, { SimpleGit, CloneOptions } from 'simple-git'
import path from 'path'
import fs from 'fs/promises'
import { createOctokitClient } from './github'
import GithubCredential from '@/database/github_credential'
import Repository from '@/database/repository'
import { getDb } from '@/database/db'
import { spawn } from 'child_process'
import { logger } from './logger'

const GIT_DATA_PATH = process.env.GIT_DATA_PATH || './data/git_repos'
const CONTENT_CACHE_PATH = path.resolve(GIT_DATA_PATH, 'content_cache')

interface FileInfo {
  path: string
  size: number
  objectHash: string  // The blob hash from ls-tree
}

/**
 * Get the absolute path for a repository
 *
 * @param storagePath - Storage path from the Repository model
 * @returns Absolute path to the repository
 */
export function getRepositoryPath(storagePath: string): string {
  return path.resolve(GIT_DATA_PATH, storagePath)
}

/**
 * Get authenticated clone URL
 *
 * @param credential - GitHub credential
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Authenticated URL for git operations
 */
async function getAuthenticatedUrl(
  credential: GithubCredential,
  owner: string,
  repo: string
): Promise<string> {
  let token: string

  const kind = credential.kind

  if (kind === 'pat') {
    token = credential.access_token!
  } else if (kind === 'github_app_installation' || kind === 'oauth_user') {
    // createAppAuth handles installation token creation and caching internally
    const octokit = await createOctokitClient(credential)
    const { token: installationToken } = await octokit.auth({ type: 'installation' }) as { token: string }
    token = installationToken
  } else {
    throw new Error(`Unsupported credential kind: ${kind}`)
  }

  return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
}

/**
 * Serialize git operations against the same repository.
 *
 * Two layers:
 * - In-process: callers within the same Node process share one in-flight promise,
 *   avoiding redundant fetches.
 * - Cross-process: the API server and the worker may both touch the same repo dir.
 *   We take a row-level `FOR NO KEY UPDATE` lock on the repositories row inside a
 *   transaction; the lock auto-releases on commit / rollback / connection drop.
 *   NO KEY UPDATE is used so FK lookups from other tables (pull_requests, etc.)
 *   are not blocked by a long fetch.
 */
const inflightFetches = new Map<string, Promise<{ commitSha: string; updated: boolean }>>()
const inflightClones = new Map<string, Promise<{ path: string; alreadyExists: boolean }>>()

async function withRepoRowLock<T>(repository: Repository, fn: () => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await Repository.findByPk(repository.id, {
      lock: tx.LOCK.NO_KEY_UPDATE,
      transaction: tx,
    })
    return fn()
  })
}

/**
 * Check if a directory is a git repository
 */
async function isGitRepository(repoPath: string): Promise<boolean> {
  try {
    const git = simpleGit(repoPath)
    await git.revparse(['--git-dir'])
    return true
  } catch {
    return false
  }
}

/**
 * Clone a repository to local storage
 *
 * @param credential - GitHub credential for authentication
 * @param repository - Repository model instance
 * @returns Path to the cloned repository
 */
export async function cloneRepository(
  credential: GithubCredential,
  repository: Repository
): Promise<{
  path: string
  alreadyExists: boolean
}> {
  const key = repository.storage_path
  const existing = inflightClones.get(key)
  if (existing) return existing

  const p = withRepoRowLock(repository, () => doCloneRepository(credential, repository))
    .finally(() => inflightClones.delete(key))
  inflightClones.set(key, p)
  return p
}

async function doCloneRepository(
  credential: GithubCredential,
  repository: Repository
): Promise<{
  path: string
  alreadyExists: boolean
}> {
  const repoPath = getRepositoryPath(repository.storage_path)

  // Check if repository already exists
  if (await isGitRepository(repoPath)) {
    logger.info(`Repository ${repository.github_owner}/${repository.github_repo} already exists at ${repoPath}`)
    return {
      path: repoPath,
      alreadyExists: true,
    }
  }

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(repoPath), { recursive: true })

  const url = await getAuthenticatedUrl(credential, repository.github_owner, repository.github_repo)
  const branch = repository.tracking_branch || 'main'

  logger.info(`Cloning ${repository.github_owner}/${repository.github_repo} to ${repoPath}...`)

  try {
    const git = simpleGit()
    const cloneOptions: CloneOptions = {
      '--branch': branch,
    }

    await git.clone(url, repoPath, cloneOptions)
    logger.info(`Successfully cloned ${repository.github_owner}/${repository.github_repo}`)

    return {
      path: repoPath,
      alreadyExists: false,
    }
  } catch (error) {
    logger.error(`Failed to clone ${repository.github_owner}/${repository.github_repo}:`, error)
    throw new Error(`Failed to clone repository: ${(error as Error).message}`)
  }
}

/**
 * Delete a repository's working directory from disk.
 *
 * Idempotent: missing directories are not treated as an error.
 */
export async function deleteRepositoryFromDisk(repository: Repository): Promise<void> {
  const repoPath = getRepositoryPath(repository.storage_path)
  logger.info(`Deleting repository directory at ${repoPath}...`)
  await fs.rm(repoPath, { recursive: true, force: true })
}

/**
 * Fetch and update repository to latest commit on tracking branch
 *
 * @param credential - GitHub credential for authentication
 * @param repository - Repository model instance
 * @returns Latest commit SHA
 */
export async function fetchAndUpdate(
  credential: GithubCredential,
  repository: Repository
): Promise<{
  commitSha: string
  updated: boolean
}> {
  const key = repository.storage_path
  const existing = inflightFetches.get(key)
  if (existing) return existing

  const p = withRepoRowLock(repository, () => doFetchAndUpdate(credential, repository))
    .finally(() => inflightFetches.delete(key))
  inflightFetches.set(key, p)
  return p
}

async function doFetchAndUpdate(
  credential: GithubCredential,
  repository: Repository
): Promise<{
  commitSha: string
  updated: boolean
}> {
  const repoPath = getRepositoryPath(repository.storage_path)
  const branch = repository.tracking_branch || 'main'

  try {
    const git = simpleGit(repoPath)

    // Get current HEAD commit before fetch
    const oldSha = await git.revparse(['HEAD']).catch(() => null)

    logger.info(`Fetching updates for ${repository.github_owner}/${repository.github_repo}...`)

    // Update remote URL with fresh token (tokens may expire)
    const url = await getAuthenticatedUrl(credential, repository.github_owner, repository.github_repo)
    await git.remote(['set-url', 'origin', url])

    // Fetch all branches from remote
    await git.fetch('origin')

    // Get the latest commit on the remote tracking branch
    const remoteBranch = `origin/${branch}`
    const newSha = await git.revparse([remoteBranch])

    // Check if update is needed
    if (oldSha?.trim() === newSha.trim()) {
      logger.info(`Repository ${repository.github_owner}/${repository.github_repo} is already up to date`)
      return {
        commitSha: newSha.trim(),
        updated: false,
      }
    }

    logger.info(`Updating ${repository.github_owner}/${repository.github_repo} from ${oldSha?.substring(0, 7)} to ${newSha.substring(0, 7)}`)

    // Reset to the latest commit (hard reset)
    await git.reset(['--hard', remoteBranch])

    // Checkout the branch
    await git.checkout(branch)

    logger.info(`Successfully updated ${repository.github_owner}/${repository.github_repo} to ${newSha}`)

    return {
      commitSha: newSha.trim(),
      updated: true,
    }
  } catch (error) {
    logger.error(`Failed to fetch and update ${repository.github_owner}/${repository.github_repo}:`, error)
    throw error
  }
}

/**
 * Check if a file is likely binary
 */
function isBinaryFile(buffer: Buffer): boolean {
  // Check for null bytes in the first 8000 bytes
  const length = Math.min(buffer.length, 8000)
  for (let i = 0; i < length; i++) {
    if (buffer[i] === 0) {
      return true
    }
  }
  return false
}

/**
 * Check if a path matches any exclude pattern
 */
function shouldExcludePath(filePath: string, excludePatterns: string[]): boolean {
  return excludePatterns.some(pattern => {
    // Simple pattern matching
    if (pattern.endsWith('/**')) {
      const dirName = pattern.slice(0, -3)
      return filePath.startsWith(dirName + '/') || filePath === dirName
    }
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1)
      return filePath.endsWith(ext)
    }
    return filePath === pattern
  })
}

/**
 * Get a commit with retry logic
 *
 * Tries to get the commit, and if it doesn't exist, fetches updates and retries
 *
 * @param credential - GitHub credential
 * @param repository - Repository model instance
 * @param commitSha - Commit SHA to find
 * @returns The git instance and verified commit SHA
 */
async function getCommitWithRetry(
  credential: GithubCredential,
  repository: Repository,
  commitSha: string
): Promise<{ git: SimpleGit; commitSha: string }> {
  const repoPath = getRepositoryPath(repository.storage_path)

  // Check if repository exists
  if (!(await isGitRepository(repoPath))) {
    throw new Error(`Repository ${repository.github_owner}/${repository.github_repo} not found. Please clone it first.`)
  }

  const git = simpleGit(repoPath)

  // Try to verify the commit exists
  try {
    await git.catFile(['-t', commitSha])
    return { git, commitSha }
  } catch {
    // Commit not found, try fetching updates
    logger.info(`Commit ${commitSha} not found locally, fetching updates...`)

    try {
      await fetchAndUpdate(credential, repository)

      // Try to verify the commit again after update
      await git.catFile(['-t', commitSha])
      return { git, commitSha }
    } catch {
      throw new Error(`Commit ${commitSha} not found in repository ${repository.github_owner}/${repository.github_repo} even after fetching updates. The commit may not exist.`)
    }
  }
}

/**
 * Batch fetch file contents using a single git process
 */
export async function batchGetFileContents(
  repoPath: string,
  files: FileInfo[]
): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    const results = new Map<string, Buffer>()
    
    // Create a map from objectHash -> path for lookup
    const hashToPath = new Map(files.map(f => [f.objectHash, f.path]))
    
    const catFile = spawn('git', ['cat-file', '--batch'], { 
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let buffer = Buffer.alloc(0)
    let currentHash: string | null = null
    let currentSize = 0
    let headerParsed = false

    catFile.stdout.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk])

      while (buffer.length > 0) {
        if (!headerParsed) {
          // Look for header line ending with \n
          const newlineIdx = buffer.indexOf('\n')
          if (newlineIdx === -1) break  // Need more data

          const header = buffer.slice(0, newlineIdx).toString()
          buffer = buffer.slice(newlineIdx + 1)

          // Parse: "<hash> <type> <size>" or "<hash> missing"
          const parts = header.split(' ')
          if (parts[1] === 'missing') {
            continue  // Object not found, skip
          }

          currentHash = parts[0]
          currentSize = parseInt(parts[2], 10)
          headerParsed = true
        }

        if (headerParsed) {
          // Need size + 1 bytes (content + trailing newline)
          if (buffer.length < currentSize + 1) break  // Need more data

          const content = buffer.slice(0, currentSize)
          buffer = buffer.slice(currentSize + 1)  // +1 for trailing \n

          const filePath = hashToPath.get(currentHash!)
          if (filePath) {
            results.set(filePath, content)
          }

          // Reset for next object
          currentHash = null
          currentSize = 0
          headerParsed = false
        }
      }
    })

    catFile.stderr.on('data', (data) => {
      logger.error('git cat-file error:', data.toString())
    })

    catFile.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`git cat-file exited with code ${code}`))
      } else {
        resolve(results)
      }
    })

    catFile.on('error', reject)

    // Write all blob hashes to stdin
    for (const file of files) {
      catFile.stdin.write(`${file.objectHash}\n`)
    }
    catFile.stdin.end()
  })
}

/**
 * Optimized getRepositoryContent using batch operations
 */
export async function getRepositoryContent(
  credential: GithubCredential,
  repository: Repository,
  commitSha: string,
  options: {
    includeBinary?: boolean
    maxFileSize?: number
    excludePatterns?: string[]
  } = {}
): Promise<Array<{ path: string; content: string | null; size: number; isBinary: boolean }>> {
  const {
    includeBinary = false,
    maxFileSize = 10 * 1024 * 1024,
    excludePatterns = ['node_modules/**', '.git/**', '*.lock', 'package-lock.json', 'yarn.lock'],
  } = options

  // Check disk cache — commitSha is immutable so no invalidation needed
  const cacheFile = path.join(CONTENT_CACHE_PATH, `${repository.github_owner}__${repository.github_repo}__${commitSha}.json`)
  try {
    const cached = await fs.readFile(cacheFile, 'utf-8')
    logger.info(`Content cache hit: ${repository.github_owner}/${repository.github_repo}@${commitSha}`)
    return JSON.parse(cached)
  } catch {
    // Cache miss, proceed
  }

  const { git } = await getCommitWithRetry(credential, repository, commitSha)
  const repoPath = getRepositoryPath(repository.storage_path)

  // Step 1: Get all file metadata with blob hashes
  logger.info(`Listing files at commit ${commitSha}...`)
  const treeOutput = await git.raw(['ls-tree', '-r', '--long', commitSha])
  const lines = treeOutput.trim().split('\n').filter(Boolean)

  const filesToFetch: FileInfo[] = []

  for (const line of lines) {
    // Parse: "100644 blob <hash> <size>\t<path>"
    const match = line.match(/^\d+\s+blob\s+([a-f0-9]+)\s+(\d+|-)\t(.+)$/)
    if (!match) continue

    const [, objectHash, sizeStr, filePath] = match
    const size = sizeStr === '-' ? 0 : parseInt(sizeStr, 10)

    if (shouldExcludePath(filePath, excludePatterns)) continue
    if (size > maxFileSize) {
      logger.info(`Skipping large file: ${filePath} (${size} bytes)`)
      continue
    }

    filesToFetch.push({ path: filePath, size, objectHash })
  }

  logger.info(`Fetching ${filesToFetch.length} files in batch...`)

  // Step 2: Batch fetch all contents using blob hashes
  const contentMap = await batchGetFileContents(repoPath, filesToFetch)

  // Step 3: Build results
  const files = filesToFetch.map(file => {
    const contentBuffer = contentMap.get(file.path)
    
    if (!contentBuffer) {
      return { path: file.path, content: null, size: file.size, isBinary: false }
    }

    const binary = isBinaryFile(contentBuffer)
    
    if (binary && !includeBinary) {
      return { path: file.path, content: null, size: file.size, isBinary: true }
    }

    return {
      path: file.path,
      content: binary ? contentBuffer.toString('base64') : contentBuffer.toString('utf-8'),
      size: file.size,
      isBinary: binary,
    }
  })

  logger.info(`Successfully retrieved ${files.length} files`)

  // Write to disk cache
  await fs.mkdir(CONTENT_CACHE_PATH, { recursive: true })
  await fs.writeFile(cacheFile, JSON.stringify(files), 'utf-8')

  return files
}
