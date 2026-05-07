import { Octokit } from '@octokit/rest'
import GithubCredential from '@/database/github_credential'
import { getValidAccessToken } from './github_token'

/**
 * Get the installation_id for a credential.
 *
 * Resolution order:
 *   1. The typed `installation_id` column (written by the App install callback).
 * 
 */
export async function getInstallationId(credential: GithubCredential): Promise<string> {
  if (credential.installation_id) {
    return String(credential.installation_id)
  }

  throw new Error('Installation ID not found')
}
