import GithubCredential from '@/database/github_credential'
import User from '@/database/user'
import { isSaaS } from './deployment'
import { logger } from './logger'

export class CredentialNotFoundError extends Error {
  code = 'CREDENTIAL_NOT_FOUND'
  constructor(msg: string) {
    super(msg)
    this.name = 'CredentialNotFoundError'
  }
}

/**
 * Resolve a credential suitable for reading repo state.
 *
 * SaaS:        team-level github_app_installation preferred;
 *              falls back to user's oauth_user credential with a warning
 *              (transitional — removed once every team has an App install).
 * Self-hosted: team PAT preferred, user PAT fallback.
 */
export async function getReadCredential(user: User): Promise<GithubCredential> {
  if (isSaaS()) {
    const teamInstall = await GithubCredential.findOne({
      where: { kind: 'github_app_installation', team_id: user.team_id },
    })
    if (teamInstall) return teamInstall

    const userOAuth = await GithubCredential.findOne({
      where: { kind: 'oauth_user', user_id: user.id },
    })
    if (userOAuth) {
      logger.warn(
        `Falling back to oauth_user read credential for user ${user.id}; team ${user.team_id} has no GitHub App installation.`
      )
      return userOAuth
    }

    throw new CredentialNotFoundError(
      'No GitHub App installation for this team. Install the FastPR GitHub App to continue.'
    )
  }

  const teamPat = await GithubCredential.findOne({
    where: { kind: 'pat', team_id: user.team_id, account_type: 'Organization' },
  })
  if (teamPat) return teamPat

  const userPat = await GithubCredential.findOne({
    where: { kind: 'pat', user_id: user.id, account_type: 'User' },
  })
  if (userPat) return userPat

  throw new CredentialNotFoundError(
    'No Personal Access Token on file. Please add your PAT in settings.'
  )
}

/**
 * Resolve a credential suitable for writing (posting comments, reviews).
 *
 * SaaS:        user's OAuth token (writes attribute to the user).
 * Self-hosted: user PAT preferred, team PAT fallback.
 */
export async function getWriteCredential(user: User): Promise<GithubCredential> {
  if (isSaaS()) {
    const userOAuth = await GithubCredential.findOne({
      where: { kind: 'oauth_user', user_id: user.id },
    })
    if (userOAuth) return userOAuth

    throw new CredentialNotFoundError('GitHub login required to post comments.')
  }

  const userPat = await GithubCredential.findOne({
    where: { kind: 'pat', user_id: user.id, account_type: 'User' },
  })
  if (userPat) return userPat

  const teamPat = await GithubCredential.findOne({
    where: { kind: 'pat', team_id: user.team_id, account_type: 'Organization' },
  })
  if (teamPat) return teamPat

  throw new CredentialNotFoundError(
    'No Personal Access Token on file. Please add your PAT to post comments.'
  )
}
