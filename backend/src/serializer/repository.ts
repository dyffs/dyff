import Repository from '@/database/repository'

export interface SerializedRepository {
  id: string
  github_owner: string
  github_repo: string
  full_name: string
  tracking_branch: string
  status: 'new' | 'cloning' | 'cloned'
  owner_type: 'user' | 'organization'
  last_fetched_at: Date | null
  created_at: Date
  updated_at: Date
}

export function serializeRepository(repository: Repository): SerializedRepository {
  return {
    id: repository.id,
    github_owner: repository.github_owner,
    github_repo: repository.github_repo,
    full_name: `${repository.github_owner}/${repository.github_repo}`,
    tracking_branch: repository.tracking_branch,
    status: repository.status || 'new',
    owner_type: repository.owner_type,
    last_fetched_at: repository.last_fetched_at || null,
    created_at: repository.created_at,
    updated_at: repository.updated_at,
  }
}

export function serializeRepositories(repositories: Repository[]): SerializedRepository[] {
  return repositories.map(serializeRepository)
}
