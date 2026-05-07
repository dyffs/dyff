import passport from 'passport'
import { Strategy as GitHubStrategy } from 'passport-github2'
import User from '@/database/user'
import Team from '@/database/team'
import GithubCredential from '@/database/github_credential'
import { generateTeamName } from '@/service/utils'
import { isSaaS } from '@/service/deployment'
import { logger } from '@/service/logger'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3003/api/auth/github/callback'

// Only enforce GitHub OAuth env in SaaS mode. Self-hosted deployments don't
// use OAuth; they authenticate users via email+password.
if (isSaaS() && (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET)) {
  throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set in environment')
}

// Helper to fetch user email from GitHub API
async function fetchGitHubEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Dyff-Backend',
      },
    })

    if (!response.ok) {
      logger.warn('Failed to fetch GitHub emails:', response.status)
      return null
    }

    const emails = await response.json() as Array<{ email: string; primary: boolean; verified: boolean }>
    // Find primary email, or first verified email, or any email
    const primary = emails.find(e => e.primary && e.verified)
    if (primary) return primary.email

    const verified = emails.find(e => e.verified)
    if (verified) return verified.email

    return emails[0]?.email || null
  } catch (error) {
    logger.error('Error fetching GitHub email:', error)
    return null
  }
}

// Custom GitHub strategy that doesn't try to fetch emails automatically
const githubStrategy = new GitHubStrategy(
  {
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: GITHUB_CALLBACK_URL,
    // Reads go through the GitHub App installation; the OAuth token is only
    // used for writing comments under the user's identity. Narrowed scope.
    // If private-repo comment writes require more, add 'public_repo' or
    // escalate based on observed 403s.
    scope: ['user:email', 'read:user'],
  },
  async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      const githubId = profile.id
      const githubUsername = profile.username

      // Try to get email from profile, otherwise fetch from API
      let email = profile.emails?.[0]?.value
      if (!email) {
        email = await fetchGitHubEmail(accessToken)
      }
      email = email || `${githubUsername}@github.local`

      const displayName = profile.displayName || githubUsername

        // Try to find existing user by github_username
        let user = await User.findOne({
          where: { github_username: githubUsername }
        })

        if (!user) {
          // Auto-create team for the user
          const teamName = generateTeamName(email)
          const team = await Team.create({
            display_name: teamName,
            settings: {},
          })

          // Create user associated with the team
          user = await User.create({
            email,
            display_name: displayName,
            role: 'admin',
            status: 'registered',
            settings: {},
            is_bot: false,
            team_id: team.id,
            last_login_at: new Date(),
            github_username: githubUsername,
          })
        } else {
          // Update last login
          user.last_login_at = new Date()
          await user.save()
        }

        // Store or update GitHub credential
        // GitHub tokens expire after 8 hours
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000)

        const existingCredential = await GithubCredential.findOne({
          where: {
            kind: 'oauth_user',
            user_id: user.id,
          }
        })

        if (existingCredential) {
          existingCredential.access_token = accessToken
          existingCredential.refresh_token = refreshToken
          existingCredential.access_token_expires_at = expiresAt
          await existingCredential.save()
        } else {
          await GithubCredential.create({
            kind: 'oauth_user',
            user_id: user.id,
            team_id: user.team_id,
            account_type: 'User',
            account_login: githubUsername,
            access_token: accessToken,
            refresh_token: refreshToken,
            access_token_expires_at: expiresAt,
            credentials: {
              github_id: githubId,
              github_username: githubUsername,
            },
          })
        }

        return done(null, user)
      } catch (error) {
        return done(error as Error)
      }
    }
  )

// Override userProfile to skip email fetching (we do it ourselves)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
githubStrategy.userProfile = function(accessToken: string, done: (err?: Error | null, profile?: any) => void) {
  this._oauth2.get('https://api.github.com/user', accessToken, (err, body) => {
    if (err) {
      return done(new Error('Failed to fetch user profile'))
    }

    try {
      const json = JSON.parse(body as string)
      const profile: any = {
        provider: 'github',
        id: json.id,
        displayName: json.name,
        username: json.login,
        emails: json.email ? [{ value: json.email }] : [],
        photos: json.avatar_url ? [{ value: json.avatar_url }] : [],
        _raw: body,
        _json: json,
      }
      done(null, profile)
    } catch (e) {
      done(new Error('Failed to parse user profile'))
    }
  })
}

passport.use(githubStrategy)

// Serialize user for session (not used with JWT but required by passport)
passport.serializeUser((user: any, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findByPk(id)
    done(null, user)
  } catch (error) {
    done(error)
  }
})

export default passport
