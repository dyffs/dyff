import User from "@/database/user";
import ChatSessionModel from "@/database/chat_session";
import PullRequest from "@/database/pull_request";
import { ChatSession } from "../ai_agent/types";
import path from "path";
import fs from "fs";

import { diffOverviewHandler } from "../tools/diff_tool";

export function readSystemPrompt(filename: string) {
  const baseDir = process.env.PROMPTS_PATH;
  if (!baseDir) {
    throw new Error("PROMPTS_PATH is not set");
  }
  const filePath = path.join(baseDir as string, filename + ".md");
  return fs.readFileSync(filePath, "utf8");
}

export async function createChatSession(payload: {
  user: User;
  agentName: string;
  commitHash: string;
  pullRequestId: string;
  repoId: string;
  githubPrNumber: number;
  systemPrompt: string;
}) {
  const id = '-1';

  const defaultChatSession: ChatSession = {
    id,
    agentName: payload.agentName,
    messages: [],
    status: 'idle',
    totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    commitHash: payload.commitHash,
    systemPrompt: payload.systemPrompt,
  };

  const chatSessionRecord = await ChatSessionModel.create({
    user_id: payload.user.id,
    team_id: payload.user.team_id,
    pull_request_id: payload.pullRequestId,
    github_pr_number: payload.githubPrNumber,
    repository_id: payload.repoId,
    status: 'idle',
    session_data: defaultChatSession,
  });

  chatSessionRecord.session_data = {
    ...defaultChatSession,
    id: chatSessionRecord.id,
  }
  await chatSessionRecord.save();

  return chatSessionRecord;
}


export async function buildInitialMessage(pr: PullRequest, session: ChatSessionModel, user: User) {
  const diffOverview = await diffOverviewHandler.execute({}, session.session_data, user);

  const initialMessage = `
# PR Overview
Title: ${pr.title}

${pr.description}

# Diff Overview
${diffOverview.output}
  `;

  return initialMessage;
}
