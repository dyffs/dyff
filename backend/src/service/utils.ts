import User from "@/database/user"
import type { PublicUserInfo } from "@/types"
import type { Comment } from "@/module/comment/types"


export function generateTeamName(email: string): string {
  const username = email.split('@')[0]
  const timestamp = Date.now().toString(36)
  return `${username}-team-${timestamp}`.toLowerCase()
}


export async function getPublicUserInfo (ids: string[]): Promise<Map<string, PublicUserInfo>> {
  const users = await User.findAll({
    where: {
      id: ids,
    },
    attributes: ['id', 'github_username', 'display_name'],
  })

  const publicUserInfo = new Map<string, PublicUserInfo>()
  users.forEach(user => {
    publicUserInfo.set(user.id, {
      id: user.id,
      github_username: user.github_username,
      display_name: user.display_name,
    })
  })
  return publicUserInfo
}

export function normalizeCodeAnchor(githubPayload: {
  commit_sha: string
  file_path: string
  original_line?: number
  line?: number
  start_line?: number | null
  original_start_line?: number | null
  start_side?: 'LEFT' | 'RIGHT' | null
  side?: 'LEFT' | 'RIGHT'
}): Comment['code_anchor'] {
  return {
    commit_sha: githubPayload.commit_sha,
    file_path: githubPayload.file_path,
    side: githubPayload.side || githubPayload.start_side || 'RIGHT',
    line_start: githubPayload.start_line || githubPayload.original_start_line || 0,
    line_end: githubPayload.line || githubPayload.original_line || 0,
  }
}