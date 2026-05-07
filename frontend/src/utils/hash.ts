import type { FileDiff } from '@/types'

function fnv1a (str: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    // Perform 32-bit integer multiplication
    hash = Math.imul(hash, 0x01000193)
  }
  // Return as a hex string
  return (hash >>> 0).toString(16)
}

async function hashFileContent (content: string): Promise<string> {
  return fnv1a(content)
}

async function computeFileHash (file: FileDiff): Promise<string> {
  // Create a stable representation of the file diff for hashing
  // Include: path, status, and all hunk content
  const representation = [
    file.newPath,
    file.status,
    ...file.hunks.flatMap(hunk =>
      hunk.lines.map(line => `${line.type}:${line.content}`)
    )
  ].join('\n')

  return await hashFileContent(representation)
}

export { hashFileContent, computeFileHash }