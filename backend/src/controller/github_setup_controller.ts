import express, { Request, Response } from 'express'
import { Octokit } from '@octokit/rest'
import GithubCredential from '@/database/github_credential'
import { requestContext } from '@/service/requestContext'
import { logger } from '@/service/logger'
import User from '@/database/user'

const router = express.Router()

// GET /status — report whether the current user and their team have a GitHub
// connection. Shape is the same in both modes so the frontend can render a
// unified settings screen.
router.get('/status', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()

    let userConnected: boolean
    let teamConnected: boolean
    let userPatUsedForTeam: boolean | undefined

    // TODO: [app]
    // const userOAuth = await GithubCredential.findOne({
    //   where: { kind: 'oauth_user', user_id: user.id },
    // })
    // userConnected = !!userOAuth

    // const teamInstall = await GithubCredential.findOne({
    //   where: { kind: 'github_app_installation', team_id: user.team_id },
    // })
    // teamConnected = !!teamInstall

    const userPat = await GithubCredential.findOne({
      where: { kind: 'pat', user_id: user.id, account_type: 'User' },
    })
    userConnected = !!userPat

    const teamPat = await GithubCredential.findOne({
      where: { kind: 'pat', team_id: user.team_id, account_type: 'Organization' },
    })
    teamConnected = !!teamPat

    userPatUsedForTeam =
      !!userPat && !!teamPat && userPat.access_token === teamPat.access_token

    return res.status(200).json({
      mode: 'pat',
      user_connected: userConnected,
      team_connected: teamConnected,
      ...(userPatUsedForTeam !== undefined && {
        user_pat_used_for_team: userPatUsedForTeam,
      }),
    })
  } catch (err) {
    logger.error('Error reading github setup status:', err)
    return res.status(500).json({
      error: 'Failed to read GitHub setup status',
      message: (err as Error).message,
    })
  }
})

// POST /personal_access_token — self-hosted only.
// Always upserts the user's personal PAT. If `for_team: true` and the caller is
// an admin, also upserts the same token as the team PAT (account_type
// 'Organization') so other teammates inherit access via getReadCredential.
router.post('/personal_access_token', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { personal_access_token, for_team } = req.body ?? {}

    if (!personal_access_token || typeof personal_access_token !== 'string') {
      return res.status(400).json({ error: 'personal_access_token is required' })
    }

    if (for_team && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only admins can set the team Personal Access Token.',
      })
    }

    // Validate the PAT by calling GET /user.
    const probe = new Octokit({ auth: personal_access_token })
    let accountLogin: string
    try {
      const { data } = await probe.rest.users.getAuthenticated()
      accountLogin = data.login
    } catch (err) {
      logger.warn('PAT validation failed:', err)
      return res.status(400).json({ error: 'Invalid Personal Access Token' })
    }

    await upsertPat({
      user_id: user.id,
      team_id: user.team_id,
      account_type: 'User',
      access_token: personal_access_token,
      account_login: accountLogin,
    })

    const u = await User.findByPk(user.id)
    if (u) {
      u.github_username = accountLogin
      await u.save()
    }

    if (for_team) {
      await upsertPat({
        user_id: user.id,
        team_id: user.team_id,
        account_type: 'Organization',
        access_token: personal_access_token,
        account_login: accountLogin,
      })
    }

    return res.status(200).json({
      ok: true,
      account_login: accountLogin,
      for_team: !!for_team,
    })
  } catch (err) {
    logger.error('Error saving PAT:', err)
    return res.status(500).json({
      error: 'Failed to save Personal Access Token',
      message: (err as Error).message,
    })
  }
})

// POST /disconnect — remove GitHub credentials.
//   - Default: remove the caller's personal credential (OAuth row in SaaS,
//     personal PAT in self-hosted).
//   - `for_team: true` (self-hosted, admin only): remove the team PAT. Since
//     that token may have been stored via `for_team` on the set endpoint, it
//     can live in two rows — the Organization row AND a User row for whichever
//     admin submitted it — so we clear both when the tokens still match.
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { for_team } = req.body ?? {}

    // TODO: [app]
    if (for_team) {
      if (user.role !== 'admin') {
        return res.status(403).json({
          error: 'Only admins can disconnect the team Personal Access Token.',
        })
      }

      const teamPat = await GithubCredential.findOne({
        where: { kind: 'pat', team_id: user.team_id, account_type: 'Organization' },
      })

      if (!teamPat) {
        return res.status(200).json({ ok: true, for_team: true, deleted: 0 })
      }

      const personalMatchDeleted = await GithubCredential.destroy({
        where: {
          kind: 'pat',
          team_id: user.team_id,
          account_type: 'User',
          access_token: teamPat.access_token,
        },
      })
      await teamPat.destroy()

      return res.status(200).json({
        ok: true,
        for_team: true,
        deleted: personalMatchDeleted + 1,
      })
    }

    // TODO: [app]
    const where = { kind: 'pat' as const, user_id: user.id, account_type: 'User' as const }

    const deleted = await GithubCredential.destroy({ where })

    return res.status(200).json({ ok: true, for_team: false, deleted })
  } catch (err) {
    logger.error('Error disconnecting GitHub credentials:', err)
    return res.status(500).json({
      error: 'Failed to disconnect GitHub',
      message: (err as Error).message,
    })
  }
})

async function upsertPat(params: {
  user_id: string
  team_id: string
  account_type: 'User' | 'Organization'
  access_token: string
  account_login: string
}) {
  const { user_id, team_id, account_type, access_token, account_login } = params

  // For a team PAT, treat it as team-scoped: the row is keyed by
  // (team_id, account_type='Organization'), regardless of which admin
  // submitted it. user_id just records the last admin who set it.
  const where = account_type === 'Organization'
    ? { kind: 'pat' as const, team_id, account_type }
    : { kind: 'pat' as const, user_id, account_type }

  const existing = await GithubCredential.findOne({ where })

  if (existing) {
    existing.user_id = user_id
    existing.team_id = team_id
    existing.access_token = access_token
    existing.account_login = account_login
    await existing.save()
    return existing
  }

  return GithubCredential.create({
    kind: 'pat',
    user_id,
    team_id,
    account_type,
    access_token,
    account_login,
    credentials: {},
  })
}

export default router
