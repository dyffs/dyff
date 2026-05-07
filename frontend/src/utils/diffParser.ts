import type { FileDiff, DiffHunk, FileTreeNode } from '@/types'

/**
 * Parse a single diff hunk (like from a PR comment's diff_hunk)
 * This handles the case where we only have the hunk content starting with @@
 */
export function parseDiffHunk (hunkText: string): DiffHunk | null {
  const lines = hunkText.split('\n')

  let currentHunk: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/)

    if (hunkMatch && hunkMatch[1] && hunkMatch[3]) {
      const oldStart = parseInt(hunkMatch[1], 10)
      const oldCount = parseInt(hunkMatch[2] ?? '1', 10)
      const newStart = parseInt(hunkMatch[3], 10)
      const newCount = parseInt(hunkMatch[4] ?? '1', 10)

      currentHunk = {
        header: line,
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: [{
          type: 'hunk',
          content: line
        }]
      }

      oldLine = oldStart
      newLine = newStart
      continue
    }

    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'addition',
          content: line.substring(1),
          newLineNumber: newLine
        })
        newLine++
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'deletion',
          content: line.substring(1),
          oldLineNumber: oldLine
        })
        oldLine++
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({
          type: 'context',
          content: line.substring(1),
          oldLineNumber: oldLine,
          newLineNumber: newLine
        })
        oldLine++
        newLine++
      } else if (line === '\\ No newline at end of file') {
        currentHunk.lines.push({
          type: 'context',
          content: line
        })
      }
    }
  }

  return currentHunk
}

export function parseDiff (diffText: string): FileDiff[] {
  const files: FileDiff[] = []
  const fileChunks = diffText.split(/(?=^diff --git )/m).filter(chunk => chunk.trim())

  for (const chunk of fileChunks) {
    const fileDiff = parseFileDiff(chunk)
    if (fileDiff) {
      files.push(fileDiff)
    }
  }

  return files
}

function parseFileDiff (chunk: string): FileDiff | null {
  const lines = chunk.split('\n')
  
  // Parse diff header: diff --git a/path b/path
  const diffMatch = lines[0]?.match(/^diff --git a\/(.+?) b\/(.+)$/)
  if (!diffMatch || !diffMatch[1] || !diffMatch[2]) return null

  const oldPath = diffMatch[1]
  const newPath = diffMatch[2]

  // Determine file status
  let status: FileDiff['status'] = 'modified'
  const hasNewFile = lines.some(l => l.startsWith('new file mode'))
  const hasDeletedFile = lines.some(l => l.startsWith('deleted file mode'))
  const hasRename = lines.some(l => l.startsWith('rename from') || l.startsWith('similarity index'))

  if (hasNewFile) status = 'added'
  else if (hasDeletedFile) status = 'deleted'
  else if (hasRename && oldPath !== newPath) status = 'renamed'

  // Find where hunks start (after @@ ... @@)
  const hunks: DiffHunk[] = []
  let additions = 0
  let deletions = 0

  let currentHunk: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/)
    
    if (hunkMatch && hunkMatch[1] && hunkMatch[3]) {
      if (currentHunk) {
        hunks.push(currentHunk)
      }
      
      const oldStart = parseInt(hunkMatch[1], 10)
      const oldCount = parseInt(hunkMatch[2] ?? '1', 10)
      const newStart = parseInt(hunkMatch[3], 10)
      const newCount = parseInt(hunkMatch[4] ?? '1', 10)
      
      currentHunk = {
        header: line,
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: [{
          type: 'hunk',
          content: line
        }]
      }
      
      oldLine = oldStart
      newLine = newStart
      continue
    }

    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'addition',
          content: line.substring(1),
          newLineNumber: newLine
        })
        newLine++
        additions++
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'deletion',
          content: line.substring(1),
          oldLineNumber: oldLine
        })
        oldLine++
        deletions++
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({
          type: 'context',
          content: line.substring(1),
          oldLineNumber: oldLine,
          newLineNumber: newLine
        })
        oldLine++
        newLine++
      } else if (line === '\\ No newline at end of file') {
        currentHunk.lines.push({
          type: 'context',
          content: line
        })
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk)
  }

  // Generate stable ID based on file paths
  const stableId = `${oldPath}::${newPath}`

  return {
    id: stableId,
    oldPath,
    newPath,
    status,
    hunks,
    additions,
    deletions,
    isExpanded: true
  }
}

interface TreeBuilder {
  node: FileTreeNode;
  children: Map<string, TreeBuilder>;
}

export function buildFileTree (files: FileDiff[]): FileTreeNode[] {
  const root = new Map<string, TreeBuilder>()

  for (const file of files) {
    const pathParts = file.newPath.split('/').filter(p => p.length > 0)
    let currentLevel = root
    let currentPath = ''

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i]
      if (!part) continue
      
      const isFile = i === pathParts.length - 1
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (!currentLevel.has(part)) {
        const node: FileTreeNode = {
          name: part,
          id: file.id,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          isExpanded: true
        }

        if (isFile) {
          node.fileDiff = file
        }

        currentLevel.set(part, {
          node,
          children: new Map()
        })
      }

      const current = currentLevel.get(part)!
      currentLevel = current.children
    }
  }

  // Convert the map structure to the final tree
  function convertToTree (level: Map<string, TreeBuilder>): FileTreeNode[] {
    const nodes: FileTreeNode[] = []
    
    for (const builder of level.values()) {
      const node = { ...builder.node }
      
      if (builder.children.size > 0) {
        node.children = convertToTree(builder.children)
      }
      
      nodes.push(node)
    }
    
    // Sort: folders first, then files, alphabetically
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
    
    return nodes
  }

  return convertToTree(root)
}

export function getFileIcon (status: FileDiff['status']): string {
  switch (status) {
    case 'added': return '+'
    case 'deleted': return '-'
    case 'renamed': return '→'
    default: return '~'
  }
}

export function getStatusColor (status: FileDiff['status']): string {
  switch (status) {
    case 'added': return 'text-green-500'
    case 'deleted': return 'text-red-500'
    case 'renamed': return 'text-blue-500'
    default: return 'text-yellow-500'
  }
}