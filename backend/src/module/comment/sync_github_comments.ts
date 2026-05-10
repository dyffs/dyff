import PullRequest from '@/database/pull_request'
import { fetchGithubComments } from './fetch_github_comments'
import { syncGithubCommentsToComments } from './sync_to_comments'
import GithubCredential from '@/database/github_credential'
import User from '@/database/user'
import Repository from '@/database/repository'

export async function syncGithubComments(
  credential: GithubCredential,
  pullRequest: PullRequest,
  user: User,
  repository: Repository,
) {
  await fetchGithubComments({
    credential,
    pullRequestId: pullRequest.id,
    initiatorId: user.id,
    initiatorTeamId: user.team_id,
    owner: repository.github_owner,
    repo: repository.github_repo,
    pullNumber: pullRequest.github_pr_number,
  })

  await syncGithubCommentsToComments({
    pullRequestId: pullRequest.id,
    teamId: user.team_id,
  })
}