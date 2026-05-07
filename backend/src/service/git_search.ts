import Repository from '@/database/repository'
import User from '@/database/user'
import { DEFAULT_EXCLUDE_PATTERNS } from './exclude_patterns'
import { hasRepositoryAccess } from './permission_service'
import { getRepositoryPath, fetchAndUpdate } from './git'
import { getReadCredential } from './github_credential_service'
import simpleGit from 'simple-git'

interface SearchMatch {
  line: number
  text: string
  isMatch: boolean
}

interface SearchFileResult {
  path: string
  matches: SearchMatch[]
}

interface SearchResult {
  files: SearchFileResult[]
  totalMatches: number
  truncated: boolean
}

interface SearchOptions {
  contextLines?: number
  maxMatches?: number
  excludePatterns?: string[]
}

const DEFAULT_CONTEXT_LINES = 2
const DEFAULT_MAX_MATCHES = 50

/**
 * Search repository content at a specific commit using git grep.
 * Returns matches grouped by file with context lines.
 */
export async function searchCode(
  user: User,
  repositoryId: string,
  commitSha: string,
  pattern: string,
  options?: SearchOptions,
): Promise<SearchResult> {
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

  // Verify commit exists locally; fetch if needed
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

  const contextLines = options?.contextLines ?? DEFAULT_CONTEXT_LINES
  const maxMatches = options?.maxMatches ?? DEFAULT_MAX_MATCHES
  const excludePatterns = options?.excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS

  // Build git grep arguments
  const args = [
    'grep',
    '-n',                       // show line numbers
    '--heading',                // group by file
    '-E',                       // extended regex
    `-C${contextLines}`,        // context lines
    '-I',                       // skip binary files
  ]

  // Add exclude pathspecs
  const excludeSpecs = toExcludePathspecs(excludePatterns)

  args.push('-e', pattern, commitSha, '--', ...excludeSpecs)

  let output: string
  try {
    output = await git.raw(args)
  } catch {
    // git grep exits with code 1 when no matches found
    return { files: [], totalMatches: 0, truncated: false }
  }

  if (!output.trim()) {
    return { files: [], totalMatches: 0, truncated: false }
  }

  return parseGrepOutput(output, commitSha, maxMatches)
}

/**
 * Parse git grep --heading output into structured results.
 *
 * Format with --heading:
 *   <commitSha>:<filepath>
 *   <linenum>-<context line>     (context before/after)
 *   <linenum>:<matched line>     (actual match)
 *   --                           (separator between match groups)
 */
function parseGrepOutput(output: string, commitSha: string, maxMatches: number): SearchResult {
  const prefix = commitSha + ':'
  const files: SearchFileResult[] = []
  let totalMatches = 0
  let truncated = false

  // Split into file sections by the heading lines
  const lines = output.split('\n')
  let currentFile: SearchFileResult | null = null

  for (const line of lines) {
    // File heading: "<commit>:<path>"
    if (line.startsWith(prefix)) {
      const path = line.slice(prefix.length)
      currentFile = { path, matches: [] }
      files.push(currentFile)
      continue
    }

    if (!currentFile) continue

    // Separator between match groups within a file
    if (line === '--') continue

    // Match line: "linenum:text" or context line: "linenum-text"
    const matchLine = line.match(/^(\d+):(.*)$/)
    if (matchLine) {
      totalMatches++
      if (totalMatches > maxMatches) {
        truncated = true
        break
      }
      currentFile.matches.push({
        line: parseInt(matchLine[1], 10),
        text: matchLine[2],
        isMatch: true,
      })
      continue
    }

    // Context line: "linenum-text" — include as part of the last match's context
    const contextMatch = line.match(/^(\d+)-(.*)$/)
    if (contextMatch) {
      currentFile.matches.push({
        line: parseInt(contextMatch[1], 10),
        text: contextMatch[2],
        isMatch: false,
      })
    }
  }

  // Remove files that ended up with no matches (edge case)
  const filteredFiles = files.filter((f) => f.matches.length > 0)

  return { files: filteredFiles, totalMatches, truncated }
}

/**
 * Format search results as a readable string for LLM consumption.
 */
export function formatSearchResults(result: SearchResult): string {
  if (result.files.length === 0) {
    return 'No matches found.'
  }

  const sections: string[] = []

  for (const file of result.files) {
    const header = `## ${file.path}`
    let fileOutput = header + '\n'
    
    let prevLineNum = -1

    for (const m of file.matches) {
      // Detect Gap
      if (prevLineNum !== -1 && m.line > prevLineNum + 1) {
        fileOutput += '  ...\n'
      }
      
      // Visual marker for the AI to see the HIT
      const marker = m.isMatch ? '>>' : '  ' 
      fileOutput += `${marker} ${m.line}: ${m.text}\n`
      
      prevLineNum = m.line
    }
    sections.push(fileOutput)
  }

  const summary = `Found ${result.totalMatches} match${result.totalMatches === 1 ? '' : 'es'} across ${result.files.length} file${result.files.length === 1 ? '' : 's'}.`

  let output = summary + '\n\n' + sections.join('\n\n')

  if (result.truncated) {
    output += `\n\n[Results truncated — showing first ${DEFAULT_MAX_MATCHES} matches. Narrow your search pattern for more specific results.]`
  }

  return output
}

/**
 * Convert exclude patterns to git pathspec format.
 * Reuses the same logic as git_diff.ts.
 */
function toExcludePathspecs(patterns: string[]): string[] {
  return patterns.map((p) => {
    if (p.includes('/') || p.includes('**')) {
      return `:(glob,exclude)${p}`
    }
    return `:(glob,exclude)**/${p}`
  })
}
