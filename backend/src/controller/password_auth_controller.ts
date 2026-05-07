import { Request, Response } from 'express'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '@/database/user'
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

// Self-hosted email+password login.
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {}

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const user = await User.findOne({ where: { email } })
    if (!user || !user.password_hash) {
      // Generic message to avoid user enumeration.
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const updates: Record<string, any> = { last_login_at: new Date() }

    if (user.status === 'invited') {
      updates.status = 'registered'
    }

    await user.update(updates)

    const token = signJwt(user)

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        status: user.status,
        team_id: user.team_id,
      },
    })
  } catch (err) {
    logger.error('Error in /login:', err)
    return res.status(500).json({ error: 'Failed to log in' })
  }
})

export default router
