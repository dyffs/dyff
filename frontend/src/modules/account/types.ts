interface User {
  id: string
  email: string
  display_name: string
  role: string
  status: string
  github_username: string | null
  team_id: string | null
  last_login_at: string
  created_at: string
}

interface Team {
  id: string
  display_name: string
}

interface AccountState {
  user: User | null
  team: Team | null
  github_connected: boolean
  github_token_expires_at: string | null
}

export type { User, Team, AccountState }