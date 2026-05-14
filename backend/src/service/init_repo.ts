import { logger } from "@/service/logger"
import GithubCredential from "@/database/github_credential"
import Repository from "@/database/repository"
import { cloneRepository } from "@/service/git"

export async function initRepo(credential: GithubCredential, repository: Repository): Promise<void> {
  // Trigger clone operation asynchronously
  return cloneRepository(credential, repository)
    .then(async () => {
      // Update status to 'cloned' on success
      repository.status = 'cloned'
      await repository.save()
      logger.info(`Successfully cloned ${repository.github_owner}/${repository.github_repo}`)
    })
    .catch(async (error) => {
      // Reset status to 'new' on failure so it can be retried
      logger.error(`Failed to clone ${repository.github_owner}/${repository.github_repo}:`, error)
      repository.status = 'new'
      await repository.save()
    })
}
