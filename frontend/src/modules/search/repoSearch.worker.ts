import type { RepoContent } from '@/types'
import type { WorkerRequest, WorkerResponse, SearchResult, SearchMatch } from './searchTypes'

let repoContent: RepoContent | null = null

// Simple glob pattern matcher
function matchesPattern (filePath: string, pattern: string): boolean {
  if (!pattern) return true

  // If pattern doesn't contain '/', assume user wants to match in any directory
  // e.g., '*.rb' should match 'app/models/file.rb', not just 'file.rb'
  let normalizedPattern = pattern
  if (!pattern.includes('/')) {
    normalizedPattern = '**/' + pattern
  }

  // Convert glob pattern to regex
  const regexPattern = normalizedPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\?/g, '.')

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(filePath)
}

function findMatches (content: string | null, keyword: string): SearchMatch[] {
  const matches: SearchMatch[] = []

  // Handle null or empty content
  if (!content) {
    return matches
  }

  const lines = content.split('\n')
  const lowercaseKeyword = keyword.toLowerCase()
  let globalIndex = 0

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]
    if (!line) {
      globalIndex += 1 // Just the newline character
      continue
    }

    const lowercaseLine = line.toLowerCase()
    let columnIndex = 0

    while (true) {
      const index = lowercaseLine.indexOf(lowercaseKeyword, columnIndex)
      if (index === -1) break

      matches.push({
        index: globalIndex + index,
        line: lineNum + 1,
        column: index + 1,
        lineContent: line
      })

      columnIndex = index + 1
    }

    globalIndex += line.length + 1 // +1 for newline character
  }

  return matches
}

function handleSearch (keyword: string, filePattern?: string): WorkerResponse {
  if (!repoContent) {
    return {
      type: 'error',
      error: 'No repository content loaded'
    }
  }

  const startTime = performance.now()
  const results: SearchResult[] = []
  let totalMatches = 0

  for (const file of repoContent.files) {
    // Check if file matches pattern
    if (filePattern && !matchesPattern(file.filePath, filePattern)) {
      continue
    }

    // Search for keyword in content
    const matches = findMatches(file.content, keyword)

    if (matches.length > 0) {
      results.push({
        filePath: file.filePath,
        matches
      })
      totalMatches += matches.length
    }
  }

  const searchTime = performance.now() - startTime

  return {
    type: 'search-result',
    payload: {
      results,
      totalMatches,
      searchTime
    }
  }
}

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, payload } = event.data

  try {
    switch (type) {
      case 'load':
        repoContent = payload
        self.postMessage({
          type: 'load-complete',
          success: true
        } as WorkerResponse)
        break

      case 'search': {
        const { keyword, filePattern } = payload as { keyword: string, filePattern?: string }
        const response = handleSearch(keyword, filePattern)
        self.postMessage(response)
        break
      }

      case 'clear':
        repoContent = null
        self.postMessage({
          type: 'load-complete',
          success: true
        } as WorkerResponse)
        break

      default:
        self.postMessage({
          type: 'error',
          error: `Unknown message type: ${type}`
        } as WorkerResponse)
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as WorkerResponse)
  }
}
