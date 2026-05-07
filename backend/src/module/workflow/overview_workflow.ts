import { buildAgentBlueprint, runAgentTurnAndWait } from '../orchestrator/orchestrator'
import { ContextPruner } from '../context_pruner/context_pruner'
import { ReviewedFilesPruningStrategy } from '../context_pruner/reviewed_files_strategy'
import { buildClientForTeam } from '../llms/llm_resolver'
import User from '@/database/user'
import type JobModel from '@/database/job'
import type { AgentResult } from '../orchestrator/types'
import type { WorkflowContext, WorkflowPayload } from './types'
import { pick } from 'lodash'
import PullRequest from '@/database/pull_request'
import { listFilesHandler, readFileHandler, searchFilesHandler } from '../tools/files_tool'
import { diffOverviewHandler, diffContentHandler } from '../tools/diff_tool'
import { searchCodeHandler } from '../tools/search_tool'
import { reviewNotesHandler } from '../tools/review_notes_tool'
import { createChatSession } from '../orchestrator/factory'
import type { AgentBlueprint } from '../orchestrator/types'
import { buildPrDescription, buildReviewedFilesLoader, updateJobWithChatSession } from './utils'

export interface OverviewWorkflowResult {
  rawOverview: AgentResult
  editedOverview: AgentResult
  formattedOverview: AgentResult
}

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

const OVERVIEW_TOOLS = [
  listFilesHandler,
  readFileHandler,
  searchFilesHandler,
  diffOverviewHandler,
  diffContentHandler,
  searchCodeHandler,
  reviewNotesHandler,
]

async function runOverviewUnderstand(
  ctx: WorkflowContext,
  user: User,
  job: JobModel,
): Promise<AgentResult> {
  const blueprint = buildAgentBlueprint({
    name: 'overview_bot_phase_1_v2',
    promptFile: 'overview_bot_phase_1_v2',
    tools: OVERVIEW_TOOLS,
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
    throw new Error(`Overview workflow failed: ${result.status}`)
  }

  return result
}

async function runOverviewValidate(
  ctx: WorkflowContext,
  user: User,
  job: JobModel,
  previousOutput: string,
): Promise<AgentResult> {
  const blueprint = buildAgentBlueprint({
    name: 'overview_bot_phase_2_v2',
    promptFile: 'overview_bot_phase_2_v2',
    tools: OVERVIEW_TOOLS,
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

  const chatSession = await createSessionAndUpdateJob(blueprint, job)

  const result = await runAgentTurnAndWait(blueprint, chatSession.id, previousOutput)

  if (result.status !== "completed") {
    throw new Error(`Overview validate workflow failed: ${result.status}`)
  }

  return result
}

async function runOverviewFormat(
  ctx: WorkflowContext,
  user: User,
  job: JobModel,
  previousOutput: string,
): Promise<AgentResult> {
  const blueprint = buildAgentBlueprint({
    name: 'overview_format_bot_phase_1_v2',
    promptFile: 'overview_format_bot_phase_1_v2',
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
    throw new Error(`Overview format workflow failed: ${result.status}`)
  }

  return result
}

export async function runOverviewWorkflow(
  ctx: WorkflowContext,
  user: User,
  job: JobModel,
): Promise<OverviewWorkflowResult> {
  const rawOverview = await runOverviewUnderstand(ctx, user, job)
  const editedOverview = await runOverviewValidate(ctx, user, job, rawOverview.output)
  const formattedOverview = await runOverviewFormat(ctx, user, job, editedOverview.output)

  return { rawOverview, editedOverview, formattedOverview }
}

export class OverviewWorkflow {
  static async execute_async(payload: WorkflowPayload, job: JobModel) {
    const user = await User.findByPk(job.user_id)
    if (!user) throw new Error(`User ${job.user_id} not found`)

    const result = await runOverviewWorkflow(
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

    await job.saveResult({ output: result.formattedOverview.output, metadata: {
      rawOverview: pick(result.rawOverview, ['output', 'sessionId', 'usage']),
      editedOverview: pick(result.editedOverview, ['output', 'sessionId', 'usage']),
      formattedOverview: pick(result.formattedOverview, ['output', 'sessionId', 'usage']),
    } })
  }
}
