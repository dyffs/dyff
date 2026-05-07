export interface GithubUser {
  login: string
  id: number
  node_id: string
  avatar_url: string
  type: 'Organization' | 'User' | 'Bot'
}

export interface GithubRepository {
  id: number
  node_id: string
  name: string
  full_name: string
  owner: GithubUser
  private: boolean
  html_url: string
  description: string | null
  created_at: string | null
  updated_at: string | null
  pushed_at: string | null
  visibility: string | undefined
  default_branch: string
  permissions: {
    admin: boolean
    maintain?: boolean
    push: boolean
    triage?: boolean
    pull: boolean
  } | undefined
}

export interface GithubPullRequest {
  id: number
  node_id: string
  number: number
  state: 'open' | 'closed'
  title: string
  body: string | null
  body_html: string | null
  html_url: string
  user: GithubUser
  created_at: string
  updated_at: string
  closed_at: string | null
  merged_at: string | null
  merge_commit_sha: string | null
  head: {
    ref: string
    sha: string
    repo: GithubRepository | null
  }
  base: {
    ref: string
    sha: string
    repo: GithubRepository
  }
  requested_reviewers: GithubUser[]
  draft: boolean
  merged: boolean
}

export interface GithubReview {
  id: number
  node_id: string
  user: GithubUser
  body: string | null
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  html_url: string
  submitted_at: string | null
  commit_id: string
}

export interface GithubTimelineEvent {
  id?: number
  node_id?: string
  event: string
  updated_at?: string
  created_at?: string
  actor?: GithubUser
  user?: GithubUser
  commit_id?: string
  commit_url?: string
  label?: {
    name: string
    color: string
  }
  assignee?: GithubUser
  assigner?: GithubUser
  requested_reviewer?: GithubUser
  review_requester?: GithubUser
  dismissed_review?: {
    state: string
    review_id: number
    dismissal_message: string | null
  }
  state?: string
  body?: string
  html_url?: string
  submitted_at?: string
}

// Simplified types for storing in database (JSONB columns)
export interface StoredReview {
  id: number
  user_login: string
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  submitted_at: string | null
  commit_id: string
}

export interface StoredTimelineEvent {
  event: string
  updated_at: string | null
  submitted_at: string | null
  created_at: string | null
  actor_login: string | null
  commit_id: string | null
  label_name: string | null
  assignee_login: string | null
  reviewer_login: string | null
  state: string | null
}

// GitHub comment types
export interface GithubReviewComment {
  id: number
  node_id: string
  pull_request_review_id: number | null
  diff_hunk: string
  path: string
  position: number | null
  original_position: number | null
  commit_id: string
  original_commit_id: string
  user: GithubUser
  body: string
  created_at: string
  updated_at: string
  html_url: string
  in_reply_to_id?: number
  line?: number
  original_line?: number
  start_line?: number | null
  original_start_line?: number | null
  start_side?: 'LEFT' | 'RIGHT' | null
  side?: 'LEFT' | 'RIGHT'
}

export interface GithubIssueComment {
  id: number
  node_id: string
  user: GithubUser
  body: string
  created_at: string
  updated_at: string
  html_url: string
}

export interface PublicUserInfo {
  id: string
  github_username: string | null
  display_name: string
}