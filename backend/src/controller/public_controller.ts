import { Request, Response } from 'express'
import express from 'express'
import User from '@/database/user'
import Team from '@/database/team'
import jwt from 'jsonwebtoken'
import { generateTeamName } from '@/service/utils'
import { logger } from '@/service/logger'

const router = express.Router()

function signJwt(user: User): string {
  return jwt.sign(
    {
      user_id: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '180d' }
  )
}

router.post('/create_account', async (req: Request, res: Response) => {
  try {
    const { email, displayName, githubUsername } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Auto-generate team for the user
    const teamName = generateTeamName(email)
    const team = await Team.create({
      display_name: teamName,
      settings: {},
    })

    // Create user associated with the team
    const user = await User.create({
      email,
      display_name: displayName || email.split('@')[0],
      role: 'admin',
      status: 'registered',
      settings: {},
      is_bot: false,
      team_id: team.id,
      last_login_at: new Date(),
      github_username: githubUsername,
    })

    // Sign and return JWT token
    const token = signJwt(user)

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        team_id: user.team_id,
      },
    })
  } catch (error) {
    logger.error('Error creating account:', error)
    return res.status(500).json({ error: 'Failed to create account' })
  }
})

export default router