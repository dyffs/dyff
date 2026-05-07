import { Request, Response } from 'express'
import express from 'express'
import passport from '@/config/passport'
import jwt from 'jsonwebtoken'
import User from '@/database/user'

const router = express.Router()

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

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

// Initiate GitHub OAuth
router.get('/github', passport.authenticate('github'))

// GitHub OAuth callback
router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${FRONTEND_URL}/auth/error` }),
  (req: Request, res: Response) => {
    const user = req.user as User

    if (!user) {
      return res.redirect(`${FRONTEND_URL}/auth/error`)
    }

    // Sign JWT and redirect to frontend
    const token = signJwt(user)
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`)
  }
)

export default router
