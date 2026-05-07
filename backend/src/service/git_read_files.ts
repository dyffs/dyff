import Repository from '@/database/repository'
import User from '@/database/user'
import { hasRepositoryAccess } from './permission_service'
import { getRepositoryPath, fetchAndUpdate, batchGetFileContents } from './git'
import { getReadCredential } from './github_credential_service'
import simpleGit from 'simple-git'

interface FileInfo {
  path: string
  size: number
  objectHash: string
}

/**
 * Read specific files from a repository at a given commit.
 *
 * Asserts that the user has access to the repository, then batch-reads
 * the requested files using git cat-file.
 * 
 * Security note: we don't verify the filePaths since we rely on git ls-tree and git cat-file that always
 * return git tracked objects. DO NOT read the file via file system API.
 */
export async function readFiles(
  user: User,
  repositoryId: string,
  filePaths: string[],
  commitSha: string
): Promise<Record<string, string | null>> {
  // Check permission
  const hasAccess = await hasRepositoryAccess(user.id, repositoryId)
  if (!hasAccess) {
    throw new Error('Access denied or repository not found')
  }

  const repository = await Repository.findByPk(repositoryId)
  if (!repository) {
    throw new Error('Repository not found')
  }

  const credential = await getReadCredential(user)

  const repoPath = getRepositoryPath(repository.storage_path)
  const git = simpleGit(repoPath)

  // Verify the commit exists locally; if not, fetch and retry
  try {
    await git.catFile(['-t', commitSha])
  } catch {
    await fetchAndUpdate(credential, repository)
    try {
      await git.catFile(['-t', commitSha])
    } catch {
      throw new Error(
        `Commit ${commitSha} not found in repository ${repository.github_owner}/${repository.github_repo} even after fetching updates.`
      )
    }
  }

  // Get file metadata from ls-tree for the requested paths
  const requestedSet = new Set(filePaths)
  const treeOutput = await git.raw(['ls-tree', '-r', '--long', commitSha])
  const lines = treeOutput.trim().split('\n').filter(Boolean)

  const filesToFetch: FileInfo[] = []

  for (const line of lines) {
    const match = line.match(/^\d+\s+blob\s+([a-f0-9]+)\s+(\d+|-)\t(.+)$/)
    if (!match) continue

    const [, objectHash, sizeStr, filePath] = match
    if (!requestedSet.has(filePath)) continue

    const size = sizeStr === '-' ? 0 : parseInt(sizeStr, 10)
    filesToFetch.push({ path: filePath, size, objectHash })
  }

  // Batch fetch contents using shared utility
  const contentMap = await batchGetFileContents(repoPath, filesToFetch)

  // Build result map — null for files not found or binary
  const result: Record<string, string | null> = {}
  for (const filePath of filePaths) {
    const buf = contentMap.get(filePath)
    if (!buf) {
      result[filePath] = null
      continue
    }
    if (isBinaryBuffer(buf)) {
      result[filePath] = null
      continue
    }
    result[filePath] = buf.toString('utf-8')
  }

  return result
}

/**
 * List git tracked files and directories in a repository at a given commit.
 *
 * Uses git ls-tree to list entries. When recursive is false, lists immediate
 * children of the given path (files and directories). When recursive is true,
 * lists all files under the path recursively.
 */
export async function listFiles(
  user: User,
  repositoryId: string,
  commitSha: string,
  dirPath: string = '.',
  recursive: boolean = false,
  depth?: number,
): Promise<string[]> {
  const hasAccess = await hasRepositoryAccess(user.id, repositoryId)
  if (!hasAccess) {
    throw new Error('Access denied or repository not found')
  }

  const repository = await Repository.findByPk(repositoryId)
  if (!repository) {
    throw new Error('Repository not found')
  }

  const credential = await getReadCredential(user)

  const repoPath = getRepositoryPath(repository.storage_path)
  const git = simpleGit(repoPath)

  // Verify the commit exists locally; if not, fetch and retry
  try {
    await git.catFile(['-t', commitSha])
  } catch {
    await fetchAndUpdate(credential, repository)
    try {
      await git.catFile(['-t', commitSha])
    } catch {
      throw new Error(
        `Commit ${commitSha} not found in repository ${repository.github_owner}/${repository.github_repo} even after fetching updates.`
      )
    }
  }

  // Build the tree-ish reference: "commitSha:path" or just "commitSha" for root
  const treeish = dirPath === '.' || dirPath === '' || dirPath === '/'
    ? commitSha
    : `${commitSha}:${dirPath}`

  const useRecursive = recursive || (depth !== undefined && depth > 1)
  const args = useRecursive
    ? ['ls-tree', '-r', '-t', '--name-only', treeish]
    : ['ls-tree', '--name-only', treeish]

  try {
    const output = await git.raw(args)
    let entries = output.trim().split('\n').filter(Boolean)

    // Filter by depth if specified
    if (depth !== undefined && depth > 0) {
      entries = entries.filter(entry => {
        const segments = entry.split('/').length
        return segments <= depth
      })
    }

    // When listing a subdirectory, prefix entries with the directory path
    if (dirPath !== '.' && dirPath !== '' && dirPath !== '/') {
      return entries.map(entry => `${dirPath}/${entry}`)
    }
    return entries
  } catch {
    throw new Error(`Path '${dirPath}' not found at commit ${commitSha}`)
  }
}

/**
 * Search git tracked file paths in a repository at a given commit by regex pattern.
 *
 * Lists all tracked files and filters them by a case-insensitive regex pattern
 * matched against the full path. Useful for locating files by name or path
 * fragment without reading their content.
 */
export async function searchFiles(
  user: User,
  repositoryId: string,
  commitSha: string,
  pattern: string,
  maxResults: number = 100,
): Promise<{ paths: string[]; truncated: boolean }> {
  const hasAccess = await hasRepositoryAccess(user.id, repositoryId)
  if (!hasAccess) {
    throw new Error('Access denied or repository not found')
  }

  const repository = await Repository.findByPk(repositoryId)
  if (!repository) {
    throw new Error('Repository not found')
  }

  const credential = await getReadCredential(user)

  let regex: RegExp
  try {
    regex = new RegExp(pattern, 'i')
  } catch (err) {
    throw new Error(`Invalid regex pattern: ${(err as Error).message}`)
  }

  const repoPath = getRepositoryPath(repository.storage_path)
  const git = simpleGit(repoPath)

  // Verify the commit exists locally; if not, fetch and retry
  try {
    await git.catFile(['-t', commitSha])
  } catch {
    await fetchAndUpdate(credential, repository)
    try {
      await git.catFile(['-t', commitSha])
    } catch {
      throw new Error(
        `Commit ${commitSha} not found in repository ${repository.github_owner}/${repository.github_repo} even after fetching updates.`
      )
    }
  }

  const output = await git.raw(['ls-tree', '-r', '--name-only', commitSha])
  const entries = output.trim().split('\n').filter(Boolean)

  const matches: string[] = []
  let truncated = false
  for (const entry of entries) {
    if (regex.test(entry)) {
      if (matches.length >= maxResults) {
        truncated = true
        break
      }
      matches.push(entry)
    }
  }

  return { paths: matches, truncated }
}

function isBinaryBuffer(buffer: Buffer): boolean {
  const length = Math.min(buffer.length, 8000)
  for (let i = 0; i < length; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}
