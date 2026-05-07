import GithubCredential from '@/database/github_credential'
import { logger } from './logger'

interface TokenRefreshResponse {
  access_token: string
  expires_in: number
  refresh_token: string
  refresh_token_expires_in: number
  token_type: string
  scope: string
}

/**
 * Refresh a GitHub OAuth access token using the refresh token
 *
 * @param credential - GitHub credential with refresh_token
 * @returns New access token and expiry info
 */
export async function refreshAccessToken(
  credential: GithubCredential
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  if (!credential.refresh_token) {
    throw new Error('No refresh token available')
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set')
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: credential.refresh_token,
      }),
    })

    const data = await response.json() as TokenRefreshResponse

    if (!response.ok || !data.access_token) {
      throw new Error((data as any).error || 'Failed to refresh token')
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000)

    // Update the credential in database
    credential.access_token = data.access_token
    credential.refresh_token = data.refresh_token
    credential.access_token_expires_at = expiresAt
    await credential.save()

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    }
  } catch (error) {
    logger.error('Error refreshing GitHub token:', error)
    throw new Error(`Failed to refresh GitHub token: ${(error as Error).message}`)
  }
}

/**
 * Get a valid access token for a user, refreshing if necessary
 *
 * @param credential - GitHub credential
 * @returns Valid access token
 */
export async function getValidAccessToken(credential: GithubCredential): Promise<string> {
  // Check if token is expired or about to expire (within 5 minutes)
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

  if (!credential.access_token_expires_at || credential.access_token_expires_at <= fiveMinutesFromNow) {
    const { accessToken } = await refreshAccessToken(credential)
    return accessToken
  }

  return credential.access_token
}
