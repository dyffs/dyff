interface TeamUser {
  id: string
  email: string
  display_name: string
  role: 'admin' | 'member'
  status: 'registered' | 'invited' | 'unregistered'
  team_id: string | null
  created_at: string
  last_login_at: string | null
  deleted_at: string | null
}

interface InviteUserPayload {
  email: string
  display_name: string
  password: string
}

interface UpdateUserPayload {
  display_name?: string
  role?: 'admin' | 'member'
  password?: string
  restore?: boolean
}

export type { TeamUser, InviteUserPayload, UpdateUserPayload }
