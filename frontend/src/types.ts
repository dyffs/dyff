export interface DiffLine {
  type: 'context' | 'addition' | 'deletion' | 'header' | 'hunk';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
  highlightedContent?: string;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface FileDiff {
  id: string;
  oldPath: string;
  newPath: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed';
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  isExpanded: boolean;
}

export interface FileTreeNode {
  name: string;
  id: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  fileDiff?: FileDiff;
  isExpanded?: boolean;
}


export interface GithubUser {
  login: string
  id: number
  node_id: string
  avatar_url: string
  type: 'Organization' | 'User' | 'Bot'
}

export interface SerializedCodeAnchor {
  commit_sha: string
  file_path: string
  line_start: number
  start_side: 'LEFT' | 'RIGHT'
  line_end: number
  end_side: 'LEFT' | 'RIGHT'
}

export interface SerializedRepository {
  id: string
  github_owner: string
  github_repo: string
  full_name: string
  tracking_branch: string
  status: 'new' | 'cloning' | 'cloned'
  owner_type: 'user' | 'organization'
  last_fetched_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface StoredReview {
  id: number
  user_login: string
  state: string
  submitted_at: string
  commit_id: string
}

export interface SerializedPullRequest {
  id: string
  repository_id: string
  author_id: string
  author_github_username: string | null
  github_pr_id: number
  github_pr_number: number
  reviewers: {
    github_usernames: string[]
  }
  github_url: string
  title: string
  description: string | null
  html_description: string | null
  github_status: 'open' | 'closed' | 'merged'
  base_branch: string
  head_branch: string
  head_commit_sha: string
  dyff_status: 'skipped' | 'tracked'
  github_created_at: Date
  github_updated_at: Date
  github_merged_at: Date | null
  review_rounds: {
    reviews: StoredReview[]
  }
  up_to_date: boolean
  created_at: Date
  updated_at: Date
  comments?: AppComment[]
  meta: {
    draft: boolean
  }
}

// Mockup types, clean up later
export interface DashboardPR {
  owner: string
  repo: string
  pr_number: number
  title: string
  author: string
  branch: string
  baseBranch: string
  status: 'open' | 'merged' | 'closed'
  reviewers: string[]
  isNew: boolean
  isDraft: boolean
  updatedAt: string
  updatedAtRaw: Date
  mergedAt?: string
}

export interface RepoPR {
  id: number
  title: string
  author: string
  branch: string
  baseBranch: string
  status: 'open' | 'merged' | 'closed'
  lastCommit: string
  reviewers: string[]
}

export interface RepoContent {
  files: { filePath: string, content: string }[]
  commitSha: string
  totalFiles: number
}

export interface RepoMeta {
  owner: string
  repo: string
  commitSha: string
  branch?: string
}

export interface ReviewData {
  [filePath: string]: {
    content_hash: string
  }
}

export interface NotesContent {
  type: 'doc'
  content: any[]
}

export interface CodeBookmark {
  id: string
  code_anchor: {
    file_path: string
    content_hash: string
    old_line_start?: number
    old_line_end?: number
    new_line_start?: number
    new_line_end?: number
  }
  file_diff_id: string
  description: string
  updated_at: string
}

export interface Notes {
  type: 'doc'
  content: any[]
}

export interface DiffNavigateEvent {
  fileId: string
  line?: { lineNumber: number, side: 'LEFT' | 'RIGHT' }
  options?: {
    flashing?: boolean
    expanded?: boolean
  }
}

export interface AppComment {
  id: string
  thread_id: string | null
  pull_request_id: string
  user_display_name: string // github_username or a human readable name
  user_id: string
  origin: 'human' | 'github' | 'ai_agent'
  agent_type: string | null
  status: 'active' | 'pending' | 'resolved' | 'outdated' | 'ai_working'
  content: {
    body: string | null
    body_html: string | null
    diff_hunk: string | null
  }
  attachments: object
  code_anchor: {
    commit_sha: string
    file_path: string
    line_start: number
    start_side: 'LEFT' | 'RIGHT'
    line_end: number
    end_side: 'LEFT' | 'RIGHT'
  } | null
  created_at: Date
  updated_at: Date
}


export type ChatSessionStatus = 'idle' | 'running' | 'cancelled' | 'error'