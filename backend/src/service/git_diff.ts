import Repository from '@/database/repository'
import User from '@/database/user'
import { DEFAULT_EXCLUDE_PATTERNS } from './exclude_patterns'
import { hasRepositoryAccess } from './permission_service'
import { getRepositoryPath, fetchAndUpdate } from './git'
import { getReadCredential } from './github_credential_service'
import simpleGit from 'simple-git'

export type DiffFileStatus = 'added' | 'deleted' | 'modified' | 'renamed'

export interface DiffFileStat {
  path: string
  additions: number
  deletions: number
  status: DiffFileStatus
  renamedFrom?: string
}

interface DiffContentOptions {
  excludePatterns?: string[]
  maxLinesPerFile?: number
  filePaths?: string[]
}

const DEFAULT_MAX_LINES_PER_FILE = 5000

/**
 * Convert exclude patterns to git pathspec format with recursive matching.
 * Plain patterns like "foo.lock" only match at root, so we prefix with
 * double-star to match in any subdirectory. Patterns already containing
 * a slash or double-star are left as-is.
 */
function toExcludePathspecs(patterns: string[]): string[] {
  return patterns.map((p) => {
    // Already has directory component or recursive glob — use as-is
    if (p.includes('/') || p.includes('**')) {
      return `:(glob,exclude)${p}`
    }
    // Make it match in any subdirectory
    return `:(glob,exclude)**/${p}`
  })
}

async function getRepoAndGit(user: User, repositoryId: string) {
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

  // Verify a ref exists locally, trying remote-prefixed and fetched variants.
  // Returns the resolved ref name that git can use.
  const verifyRef = async (ref: string): Promise<string> => {
    const candidates = [ref, `origin/${ref}`]
    for (const candidate of candidates) {
      try {
        await git.catFile(['-t', candidate])
        return candidate
      } catch {
        // try next candidate
      }
    }
    // None found locally — fetch and retry
    await fetchAndUpdate(credential, repository)
    for (const candidate of candidates) {
      try {
        await git.catFile(['-t', candidate])
        return candidate
      } catch {
        // try next candidate
      }
    }
    throw new Error(
      `Ref ${ref} not found in repository ${repository.github_owner}/${repository.github_repo} even after fetching updates.`
    )
  }

  return { repository, credential, git, verifyRef }
}

/**
 * Get a file-level summary of changes between base branch and head commit.
 * Uses three-dot diff (merge-base) to match GitHub PR behavior.
 */
export async function getDiffOverview(
  user: User,
  repositoryId: string,
  baseBranch: string,
  headCommitSha: string,
): Promise<DiffFileStat[]> {
  const { git, verifyRef } = await getRepoAndGit(user, repositoryId)

  const resolvedHead = await verifyRef(headCommitSha)
  const resolvedBase = await verifyRef(baseBranch)

  // Fetch numstat and name-status in parallel
  const [numstatOutput, nameStatusOutput] = await Promise.all([
    git.raw(['diff', '--numstat', `${resolvedBase}...${resolvedHead}`]),
    git.raw(['diff', '--name-status', `${resolvedBase}...${resolvedHead}`]),
  ])

  if (!numstatOutput.trim()) return []

  // Build a map of path -> status from name-status output
  const statusMap = new Map<string, { status: DiffFileStatus; renamedFrom?: string }>()
  const statusLines = nameStatusOutput.trim().split('\n').filter(Boolean)
  for (const line of statusLines) {
    const parts = line.split('\t')
    if (parts.length < 2) continue
    const code = parts[0].charAt(0)
    if (code === 'R') {
      // Renamed: R{score}\told_path\tnew_path
      const newPath = parts[2] ?? parts[1]
      statusMap.set(newPath, { status: 'renamed', renamedFrom: parts[1] })
    } else {
      const path = parts[1]
      const status: DiffFileStatus =
        code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified'
      statusMap.set(path, { status })
    }
  }

  const numstatLines = numstatOutput.trim().split('\n').filter(Boolean)
  const results: DiffFileStat[] = []

  for (const line of numstatLines) {
    // numstat format: additions\tdeletions\tpath
    // Binary files show "-\t-\tpath"
    // Renames show: additions\tdeletions\told_path => new_path  OR  additions\tdeletions\told\tnew
    const parts = line.split('\t')
    if (parts.length < 3) continue

    const [addStr, delStr, ...pathParts] = parts
    let path = pathParts.join('\t')

    // Handle rename format in numstat: "old => new" or "{old => new}/file"
    const renameMatch = path.match(/\{.+ => .+\}|.+ => .+/)
    if (renameMatch && parts.length >= 4) {
      // When rename with tab-separated paths: old\tnew
      path = pathParts[pathParts.length - 1]
    }

    const additions = addStr === '-' ? 0 : parseInt(addStr, 10)
    const deletions = delStr === '-' ? 0 : parseInt(delStr, 10)
    const info = statusMap.get(path)

    results.push({
      path,
      additions,
      deletions,
      status: info?.status ?? 'modified',
      ...(info?.renamedFrom ? { renamedFrom: info.renamedFrom } : {}),
    })
  }

  return results
}

/**
 * Get the unified diff content between base branch and head commit.
 * Uses three-dot diff (merge-base) to match GitHub PR behavior.
 */
export async function getDiffContent(
  user: User,
  repositoryId: string,
  baseBranch: string,
  headCommitSha: string,
  options?: DiffContentOptions,
): Promise<string> {
  const { git, verifyRef } = await getRepoAndGit(user, repositoryId)

  const resolvedHead = await verifyRef(headCommitSha)
  const resolvedBase = await verifyRef(baseBranch)

  const excludePatterns = options?.excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS
  const maxLinesPerFile = options?.maxLinesPerFile ?? DEFAULT_MAX_LINES_PER_FILE

  const args = ['diff', `${resolvedBase}...${resolvedHead}`]

  // Add path filtering and exclusions
  if (options?.filePaths && options.filePaths.length > 0) {
    args.push('--', ...options.filePaths)
  }
  args.push(...toExcludePathspecs(excludePatterns))

  const output = await git.raw(args)
  if (!output.trim()) return ''

  // Truncate individual file diffs that exceed maxLinesPerFile
  return truncateFileDiffs(output, maxLinesPerFile)
}

/**
 * Truncate individual file diffs that exceed the line limit.
 * Splits on "diff --git" boundaries and truncates each section independently.
 */
function truncateFileDiffs(diffOutput: string, maxLines: number): string {
  // Split into individual file diffs
  const fileDiffs = diffOutput.split(/(?=^diff --git )/m)
  const result: string[] = []

  for (const fileDiff of fileDiffs) {
    if (!fileDiff.trim()) continue

    const lines = fileDiff.split('\n')
    if (lines.length <= maxLines) {
      result.push(fileDiff)
    } else {
      const truncated = lines.slice(0, maxLines).join('\n')
      result.push(truncated + `\n[truncated — ${lines.length - maxLines} lines omitted]`)
    }
  }

  return result.join('')
}
