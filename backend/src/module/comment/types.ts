export interface Comment {
  id: string
  thread_id: string | null
  pull_request_id: string
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

export interface SerializedComment {
  id: string
  thread_id: string | null
  pull_request_id: string
  user_id: string
  user_display_name: string
  origin: Comment['origin']
  agent_type: Comment['agent_type']
  status: Comment['status']
  content: Comment['content']
  attachments: object
  code_anchor: Comment['code_anchor']
  created_at: Date
  updated_at: Date
}


export interface GithubCommentSync {
  id: string
  initiator_id: string

  github_user_name: string
  github_comment_id: string
  github_thread_id: string | null

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

  sync_state: 'synced' | 'pending_push' | 'pending_pull' | 'conflict'
  sync_direction: 'inbound' | 'outbound'
  sync_error: string | null

  // If last_synced_at is behind remote_updated_at or comment.updated_at, we need to sync the comment.
  last_synced_at: Date    

  remote_updated_at: Date // Github: updated_at

  created_at: Date
  updated_at: Date
}