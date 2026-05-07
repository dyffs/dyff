import User from "@/database/user"
import { PublicUserInfo } from "@/types"

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
