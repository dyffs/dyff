export interface CodeAnchor {
  commit_sha: string
  file_path: string
  line_start: number
  line_end: number
  side: 'LEFT' | 'RIGHT'
}
