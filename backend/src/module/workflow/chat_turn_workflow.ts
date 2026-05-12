import User from '@/database/user'
import type JobModel from '@/database/job'
import { runAgentTurnAndWait } from '../orchestrator/orchestrator'
import { buildAgentBlueprint } from '../orchestrator/orchestrator'
import ChatSessionModel from '@/database/chat_session'
import { ContextPruner } from "../context_pruner/context_pruner";
import { ReviewedFilesPruningStrategy } from "../context_pruner/reviewed_files_strategy";
import { listFilesHandler, readFileHandler, searchFilesHandler } from "../tools/files_tool";
import { diffOverviewHandler, diffContentHandler } from "../tools/diff_tool";
import { searchCodeHandler } from "../tools/search_tool";
import { reviewNotesHandler } from "../tools/review_notes_tool";
import { renderHtmlHandler } from "../tools/render_html_tool";
import { buildClientForTeam } from "../llms/llm_resolver";
import { updateJobWithChatSession } from './utils'

export interface ChatTurnPayload {
  sessionId: string
  userMessage: string
}

function buildAgentBlueprintFromSession(sessionModel: ChatSessionModel, user: User) {
  const session = sessionModel.session_data;
  const agentName = session.agentName;
  if (agentName !== "kai") {
    throw new Error(`Unsupported chat agent: ${agentName}`);
  }

  const blueprint = buildAgentBlueprint({
    name: agentName,
    systemPrompt: session.systemPrompt,
    tools: [
      listFilesHandler,
      readFileHandler,
      searchFilesHandler,
      diffOverviewHandler,
      diffContentHandler,
      searchCodeHandler,
      reviewNotesHandler,
      renderHtmlHandler,
    ],
    maxTurns: 100,
    maxTokens: 2_000_000,
    user,
    repositoryId: String(sessionModel.repository_id),
    commitHash: session.commitHash ?? "",
    pullRequestId: String(sessionModel.pull_request_id),
    githubPrNumber: sessionModel.github_pr_number,
    contextPruner: new ContextPruner([new ReviewedFilesPruningStrategy()]),
    llmClientFactory: () => buildClientForTeam(user.team_id),
    reviewedFilesLoader: async (loadedSessionId: string) => {
      const loadedSessionModel = await ChatSessionModel.findByPk(loadedSessionId, {
        attributes: ["agent_review_notes"],
      });
      return loadedSessionModel?.agent_review_notes?.reviewed_files ?? [];
    },
  });

  return blueprint;
}

export class ChatTurnWorkflow {
  static async execute_async(payload: ChatTurnPayload, job: JobModel) {
    const user = await User.findByPk(job.user_id)
    if (!user) throw new Error(`User ${job.user_id} not found`)

    const sessionModel = await ChatSessionModel.findByPk(payload.sessionId);
    if (!sessionModel) {
      throw new Error(`Chat session ${payload.sessionId} not found`);
    }

    updateJobWithChatSession(job, sessionModel);

    const blueprint = buildAgentBlueprintFromSession(sessionModel, user);

    const result = await runAgentTurnAndWait(
      blueprint,
      payload.sessionId,
      payload.userMessage,
    )

    if (result.status !== "completed") {
      throw new Error(`Chat turn workflow failed: ${result.status}`)
    }

    await job.saveResult({
      output: result.output,
      metadata: {
        sessionId: result.sessionId,
        status: result.status,
        usage: result.usage,
      },
    })
  }
}
