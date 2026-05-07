import { buildAgentBlueprint, runAgentTurnAndWait } from '../orchestrator/orchestrator'
import { ContextPruner } from '../context_pruner/context_pruner'
import { ReviewedFilesPruningStrategy } from '../context_pruner/reviewed_files_strategy'
import { buildClientForTeam } from '../llms/llm_resolver'
import User from '@/database/user'
import type { AgentResult } from '../orchestrator/types'
import type { WorkflowContext } from './types'
import PullRequest from '@/database/pull_request'
import type JobModel from '@/database/job'
import type { WorkflowPayload } from './types'
import { pick } from 'lodash'
import { buildPrDescription, buildReviewedFilesLoader, updateJobWithChatSession } from './utils'
import { listFilesHandler, readFileHandler, searchFilesHandler } from '../tools/files_tool'
import { diffOverviewHandler, diffContentHandler } from '../tools/diff_tool'
import { searchCodeHandler } from '../tools/search_tool'
import { reviewNotesHandler } from '../tools/review_notes_tool'
import ChatSessionModel from '@/database/chat_session'
import { createChatSession } from '../orchestrator/factory'
import type { AgentBlueprint } from '../orchestrator/types'

export async function createSessionAndUpdateJob(blueprint: AgentBlueprint, job: JobModel) {
  const chatSession = await createChatSession({
    user: blueprint.user,
    agentName: blueprint.name,
    commitHash: blueprint.commitHash ?? "",
    pullRequestId: blueprint.pullRequestId,
    repoId: blueprint.repositoryId,
    githubPrNumber: blueprint.githubPrNumber,
    systemPrompt: blueprint.systemPrompt,
  })

  updateJobWithChatSession(job, chatSession)

  return chatSession
}

const REVIEW_TOOLS = [
  listFilesHandler,
  readFileHandler,
  searchFilesHandler,
  diffOverviewHandler,
  diffContentHandler,
  searchCodeHandler,
  reviewNotesHandler,
]

export interface ReviewWorkflowResult {
  rawReview: AgentResult
  formattedReview: AgentResult
}

async function runReviewGenerate(
  ctx: WorkflowContext,
  user: User,
  job: JobModel,
): Promise<AgentResult> {
  const blueprint = buildAgentBlueprint({
    name: 'review_bot',
    promptFile: 'review_bot_v1',
    tools: REVIEW_TOOLS,
    maxTurns: 50,
    maxTokens: 1_000_000,
    user,
    repositoryId: ctx.repositoryId,
    commitHash: ctx.commitSha,
    pullRequestId: ctx.pullRequestId,
    githubPrNumber: ctx.githubPrNumber,
    contextPruner: new ContextPruner([new ReviewedFilesPruningStrategy()]),
    llmClientFactory: () => buildClientForTeam(user.team_id),
    reviewedFilesLoader: buildReviewedFilesLoader(),
  })

  const pr = await PullRequest.findByPk(ctx.pullRequestId)
  if (!pr) throw new Error(`Pull request ${ctx.pullRequestId} not found`)

  const chatSession = await createSessionAndUpdateJob(blueprint, job)

  const result = await runAgentTurnAndWait(blueprint, chatSession.id, buildPrDescription(pr))

  if (result.status !== "completed") {
    throw new Error(`Review generate workflow failed: ${result.status}`)
  }

  return result
}

async function runReviewFormat(
  ctx: WorkflowContext,
  user: User,
  job: JobModel,
  previousOutput: string,
): Promise<AgentResult> {
  const blueprint = buildAgentBlueprint({
    name: 'formatting_bot',
    promptFile: 'review_bot_format_v1',
    tools: [],
    maxTurns: 1,
    maxTokens: 10_000,
    user,
    repositoryId: ctx.repositoryId,
    commitHash: ctx.commitSha,
    pullRequestId: ctx.pullRequestId,
    githubPrNumber: ctx.githubPrNumber,
    llmClientFactory: () => buildClientForTeam(user.team_id),
  })

  const chatSession = await createSessionAndUpdateJob(blueprint, job)

  const result = await runAgentTurnAndWait(blueprint, chatSession.id, previousOutput)

  if (result.status !== "completed") {
    throw new Error(`Review format workflow failed: ${result.status}`)
  }

  return result
}

export async function runReviewWorkflow(
  ctx: WorkflowContext,
  user: User,
  job: JobModel,
): Promise<ReviewWorkflowResult> {
  const rawReview = await runReviewGenerate(ctx, user, job)
  const formattedReview = await runReviewFormat(ctx, user, job, rawReview.output)

  return { rawReview, formattedReview }
}

export class ReviewWorkflow {
  static async execute_async(payload: WorkflowPayload, job: JobModel) {
    const user = await User.findByPk(job.user_id)
    if (!user) throw new Error(`User ${job.user_id} not found`)

    const result = await runReviewWorkflow(
      {
        pullRequestId: payload.pullRequestId,
        repositoryId: payload.repositoryId,
        userId: job.user_id,
        teamId: job.team_id!,
        commitSha: payload.commitSha,
        githubPrNumber: payload.githubPrNumber,
        userMessage: 'Execute the task',
      },
      user,
      job,
    )

    await job.saveResult({
      output: result.formattedReview.output, metadata: {
        rawRerview: pick(result.rawReview, ['output', 'sessionId', 'usage']),
        formattedReview: pick(result.formattedReview, ['output', 'sessionId', 'usage']),
      }
    })
  }
}
