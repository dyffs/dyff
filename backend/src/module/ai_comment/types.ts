export interface AgentDefinition {
  name: string
  displayName: string
  promptFile: string   // system prompt filename in PROMPTS_PATH (without .md)
  maxTurns: number
  maxTokens: number
}

export interface AgentDispatchContext {
  pullRequestId: string
  repositoryId: string
  userId: string
  teamId: string
  commitSha: string
  userMessage: string
  triggerCommentId: string
  githubPrNumber: number
}
