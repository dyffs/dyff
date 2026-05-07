import ChatSessionModel from "@/database/chat_session";
import type JobModel from "@/database/job";
import PullRequest from "@/database/pull_request"

export function buildPrDescription(pr: PullRequest) {
  return `
Pull request information:
- Title: ${pr.title}
- Number: ${pr.github_pr_number}
- URL: ${pr.github_url}

**PR Description**

${pr.description}
`
}

export function updateJobWithChatSession(job: JobModel, chatSession: ChatSessionModel) {
  job.chat_session_id = chatSession.id;
  job.save();
}

export function buildReviewedFilesLoader() {
  return async (sessionId: string) => {
    const sessionModel = await ChatSessionModel.findByPk(sessionId, {
      attributes: ['agent_review_notes'],
    })
    return sessionModel?.agent_review_notes?.reviewed_files ?? []
  }
}
