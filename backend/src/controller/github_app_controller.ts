import { Request, Response } from 'express'
import express from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'
import GithubCredential from '@/database/github_credential'
import User from '@/database/user'
import { logger } from '@/service/logger'

export const githubAppAuthRouter = express.Router()
export const githubAppWebhookRouter = express.Router()
const router = githubAppAuthRouter

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

function getAppSlug(): string {
  const slug = process.env.GITHUB_APP_SLUG
  if (!slug) {
    throw new Error('GITHUB_APP_SLUG is not set')
  }
  return slug
}

function createAppOctokit(): Octokit {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  if (!appId || !privateKey) {
    throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set')
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey },
  })
}

async function upsertInstallation(params: {
  installationId: string
  teamId: string
  userId: string
  accountLogin: string | null
  accountType: 'User' | 'Organization'
}) {
  const { installationId, teamId, userId, accountLogin, accountType } = params

  // Prefer an existing row keyed by installation_id (the stable identity).
  const existing = await GithubCredential.findOne({
    where: { kind: 'github_app_installation', installation_id: installationId },
  })

  if (existing) {
    existing.team_id = teamId
    existing.user_id = userId
    existing.account_login = accountLogin
    existing.account_type = accountType
    await existing.save()
    return existing
  }

  return GithubCredential.create({
    kind: 'github_app_installation',
    team_id: teamId,
    user_id: userId,
    installation_id: installationId,
    account_login: accountLogin,
    account_type: accountType,
    credentials: {
      installation_id: installationId,
    },
  })
}

// Start the App install flow.
// The user's JWT is passed via `?token=` so this endpoint can run in the
// pre-auth router (the flow is a browser redirect; no Authorization header is
// available). A short-lived `state` JWT binds the install to the caller's team.
router.get('/install', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string | undefined
    if (!token) {
      return res.status(401).json({ error: 'token query param is required' })
    }

    let userId: string
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { user_id?: string }
      if (!decoded.user_id) {
        return res.status(401).json({ error: 'Invalid token' })
      }
      userId = String(decoded.user_id)
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    const user = await User.findByPk(userId)
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    const slug = getAppSlug()

    const state = jwt.sign(
      { team_id: user.team_id, user_id: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '5m' }
    )

    const url = `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`
    return res.redirect(url)
  } catch (err) {
    logger.error('Error starting GitHub App install:', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Post-install redirect from GitHub.
// GitHub appends `installation_id` and `state` to the URL configured in the
// App settings as "Setup URL".
router.get('/install/callback', async (req: Request, res: Response) => {
  try {
    const installationId = req.query.installation_id as string | undefined
    const state = req.query.state as string | undefined

    if (!installationId) {
      return res.status(400).json({ error: 'installation_id is required' })
    }
    if (!state) {
      return res.status(400).json({ error: 'state is required' })
    }

    let teamId: string
    let userId: string
    try {
      const payload = jwt.verify(state, process.env.JWT_SECRET!) as { team_id?: string; user_id?: string }
      if (!payload.team_id || !payload.user_id) {
        return res.status(400).json({ error: 'state is missing team_id or user_id' })
      }
      teamId = String(payload.team_id)
      userId = String(payload.user_id)
    } catch {
      return res.status(400).json({ error: 'Invalid or expired state' })
    }

    const appOctokit = createAppOctokit()
    const { data: installation } = await appOctokit.request('GET /app/installations/{installation_id}', {
      installation_id: Number(installationId),
    })

    const account = (installation as any).account as { login?: string; type?: string } | null
    const accountLogin = account?.login ?? null
    const accountType = (account?.type === 'Organization' || account?.type === 'User')
      ? (account.type as 'User' | 'Organization')
      : 'User'

    await upsertInstallation({
      installationId: String(installationId),
      teamId,
      userId,
      accountLogin,
      accountType,
    })

    return res.redirect(`${FRONTEND_URL}/settings/integrations?installed=1`)
  } catch (err) {
    logger.error('Error in GitHub App install callback:', err)
    return res.status(500).json({ error: (err as Error).message })
  }
})

function verifyWebhookSignature(rawBody: Buffer | string | undefined, signature: string | undefined, secret: string): boolean {
  if (!rawBody || !signature) return false
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody)
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(body)
  const expected = `sha256=${hmac.digest('hex')}`
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

// Webhook receiver. Registered before authMiddleware in index.ts.
githubAppWebhookRouter.post('/', async (req: Request, res: Response) => {
  try {
    const secret = process.env.GITHUB_APP_WEBHOOK_SECRET
    if (!secret) {
      logger.error('GITHUB_APP_WEBHOOK_SECRET is not set; rejecting webhook')
      return res.status(500).json({ error: 'Webhook secret not configured' })
    }

    const signature = req.header('X-Hub-Signature-256')
    const rawBody = (req as any).rawBody as Buffer | undefined

    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' })
    }

    const event = req.header('X-GitHub-Event')
    const payload = req.body as any

    // Respond fast — handle inline only for very small ops.
    res.status(204).end()

    if (event === 'installation') {
      const action = payload.action as string
      const installationId = String(payload.installation?.id ?? '')
      if (!installationId) return

      if (action === 'created') {
        // The install row is created by /install/callback (which has the
        // team_id and user_id from the state JWT). The webhook fires without
        // that context, so we just log here.
        logger.info(`Received installation.created for installation ${installationId}; awaiting callback to persist.`)
      } else if (action === 'deleted') {
        await GithubCredential.destroy({
          where: { kind: 'github_app_installation', installation_id: installationId },
        })
      }
    } else if (event === 'installation_repositories') {
      // No-op for now; repository tracking is user-driven via /api/repositories/track.
      logger.info(`Received installation_repositories.${payload.action} for installation ${payload.installation?.id}`)
    }
  } catch (err) {
    logger.error('Error handling GitHub webhook:', err)
    // Response already sent above; just log.
  }
})

export default router

