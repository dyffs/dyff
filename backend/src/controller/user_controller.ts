import { Request, Response } from 'express'
import express from 'express'
import bcrypt from 'bcryptjs'
import User from '@/database/user'
import Team from '@/database/team'
import GithubCredential from '@/database/github_credential'
import { requestContext } from '@/service/requestContext'
import { logger } from '@/service/logger'

const router = express.Router()

function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    status: user.status,
    team_id: user.team_id,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
    deleted_at: user.deleted_at,
  }
}

// GET /my-account - Get current user info
router.get('/my-account', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const githubCredential = await GithubCredential.findOne({
      where: { user_id: user.id, account_type: 'User' },
    })

    return res.json({
      user: {
        ...serializeUser(user),
        github_username: githubCredential?.account_login || null,
      },
      github_connected: !!githubCredential,
      github_token_expires_at: githubCredential?.access_token_expires_at || null,
    })
  } catch (error) {
    logger.error('Error fetching account:', error)
    return res.status(500).json({ error: 'Failed to fetch account' })
  }
})

// GET / - List users in the team (registered & invited only)
router.get('/', async (req: Request, res: Response) => {
  try {
    const currentUser = requestContext.currentUser()
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const users = await User.findAll({
      where: {
        team_id: currentUser.team_id,
        status: ['registered', 'invited'],
      },
      order: [['created_at', 'ASC']],
      paranoid: false,
    })

    return res.json({ users: users.map(serializeUser) })
  } catch (error) {
    logger.error('Error fetching users:', error)
    return res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// TODO: support login with github later
router.post('/invite', async (req: Request, res: Response) => {
  try {

    const currentUser = requestContext.currentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { email, display_name, password } = req.body ?? {}

    if (!email || !display_name || !password) {
      return res.status(400).json({ error: 'email, display_name, and password are required' })
    }

    const existing = await User.findOne({
      where: { email, team_id: currentUser.team_id },
      paranoid: false,
    })

    if (existing && existing.deleted_at) {
      return res.status(409).json({ error: 'This user has been deleted, please restore them instead' })
    }

    if (existing && existing.status !== 'unregistered') {
      return res.status(409).json({ error: 'A user with this email already exists in your team' })
    }

    const password_hash = await bcrypt.hash(password, 10)

    if (existing && existing.status === 'unregistered') {
      existing.display_name = display_name
      existing.password_hash = password_hash
      existing.status = 'invited'
      await existing.save()

      logger.info(`Admin ${currentUser.email} invited (converted unregistered) user ${email}`)

      return res.status(200).json({ user: serializeUser(existing) })
    }

    const invitedUser = await User.create({
      email,
      display_name,
      role: 'member',
      status: 'invited',
      settings: {},
      is_bot: false,
      team_id: currentUser.team_id,
      password_hash,
    })

    logger.info(`Admin ${currentUser.email} invited user ${email}`)

    return res.status(201).json({ user: serializeUser(invitedUser) })
  } catch (error) {
    logger.error('Error inviting user:', error)
    return res.status(500).json({ error: 'Failed to invite user' })
  }
})

// PATCH /:id - Admin updates a user (self-host only)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const currentUser = requestContext.currentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const targetUser = await User.findOne({
      where: { id: req.params.id, team_id: currentUser.team_id },
      paranoid: false,
    })
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { display_name, role, password, restore } = req.body ?? {}

    if (targetUser.deleted_at && !restore) {
      return res.status(400).json({ error: 'User is deleted' })
    }

    if (targetUser.deleted_at && restore) {
      await targetUser.restore()
      logger.info(`Admin ${currentUser.email} restored user ${targetUser.email}`)

      return res.json({ user: serializeUser(targetUser) })
    }


    if (display_name !== undefined) {
      targetUser.display_name = display_name
    }

    if (role !== undefined) {
      if (!['admin', 'member'].includes(role)) {
        return res.status(400).json({ error: 'role must be admin or member' })
      }

      if (targetUser.id === currentUser.id && role !== 'admin') {
        const adminCount = await User.count({
          where: { team_id: currentUser.team_id, role: 'admin' },
        })
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last admin' })
        }
      }

      targetUser.role = role
    }

    if (password !== undefined) {
      targetUser.password_hash = await bcrypt.hash(password, 10)
    }

    await targetUser.save()

    logger.info(`Admin ${currentUser.email} updated user ${targetUser.email}`)

    return res.json({ user: serializeUser(targetUser) })
  } catch (error) {
    logger.error('Error updating user:', error)
    return res.status(500).json({ error: 'Failed to update user' })
  }
})

// DELETE /:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const currentUser = requestContext.currentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (req.params.id === currentUser.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' })
    }

    const targetUser = await User.findOne({
      where: { id: req.params.id, team_id: currentUser.team_id },
    })
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    await targetUser.destroy()

    logger.info(`Admin ${currentUser.email} deleted user ${targetUser.email}`)

    return res.json({ message: 'User deleted successfully' })
  } catch (error) {
    logger.error('Error deleting user:', error)
    return res.status(500).json({ error: 'Failed to delete user' })
  }
})

// POST /logout - Logout user
router.post('/logout', async (req: Request, res: Response) => {
  try {
    return res.json({ message: 'Logged out successfully' })
  } catch (error) {
    logger.error('Error during logout:', error)
    return res.status(500).json({ error: 'Failed to logout' })
  }
})

export default router