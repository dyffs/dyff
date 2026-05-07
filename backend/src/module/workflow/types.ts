export interface WorkflowContext {
  pullRequestId: string
  repositoryId: string
  userId: string
  teamId: string
  commitSha: string
  githubPrNumber: number
  userMessage: string
}

export interface WorkflowPayload {
  pullRequestId: string
  repositoryId: string
  commitSha: string
  githubPrNumber: number
  userMessage: string
}