/**
 * User Service
 *
 * Handles automatic user creation for GitHub users who don't exist in our system yet.
 * These users are created with 'unregistered' status and assigned to the internal team.
 */

import User from '@/database/user'
import Team from '@/database/team'

/**
 * Find or create users based on their GitHub usernames
 *
 * This function:
 * 1. Searches for existing users by github_username only (not by team)
 * 2. Creates missing users and assigns them to the internal team
 * 3. Returns a Map of github_username -> User for efficient lookup
 *
 * @param githubUsernames - Array of GitHub usernames to find or create
 * @param userMetadata - Optional map of username -> metadata for user creation
 * @returns Map of github_username -> User
 * @throws Error if internal team not found
 */
export async function findOrCreateUsersByGithubUsername(
  githubUsernames: string[],
  teamId: string,
  userMetadata?: Map<string, { type?: string }>,
): Promise<Map<string, User>> {
  // Batch fetch existing users by github_username only
  const existingUsers = await User.findAll({
    where: {
      github_username: githubUsernames,
      team_id: teamId,
    },
  })

  // Create a map of username -> user for quick lookup
  const userMap = new Map<string, User>()
  existingUsers.forEach(u => {
    if (u.github_username) {
      userMap.set(u.github_username, u)
    }
  })

  // Identify users that need to be created
  const usersToCreate = []
  for (const username of githubUsernames) {
    if (!userMap.has(username)) {
      const metadata = userMetadata?.get(username)
      usersToCreate.push({
        email: `${username}@github.placeholder`,
        role: 'viewer',
        display_name: username,
        status: 'unregistered' as const,
        settings: {},
        github_username: username,
        is_bot: metadata?.type === 'Bot',
        team_id: teamId,
      })
    }
  }

  // Batch create missing users
  if (usersToCreate.length > 0) {
    const newUsers = await User.bulkCreate(usersToCreate)
    newUsers.forEach(u => {
      if (u.github_username) {
        userMap.set(u.github_username, u)
      }
    })
  }

  return userMap
}
