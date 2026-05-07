import { requestContext } from '@/service/requestContext'
import { Request, Response } from 'express'
import express from 'express'
import { assertPullRequestAccess } from '@/service/permission_service'
import { replyToComment, createDiffComment } from '@/service/github_comment_api'
import GithubComment from '@/database/github_comment'
import type { SerializedComment } from '@/serializer/pull_request'
import { getWriteCredential, CredentialNotFoundError } from '@/service/github_credential_service'
import { logger } from '@/service/logger'

const router = express.Router()

function credentialErrorResponse(res: Response, err: CredentialNotFoundError) {
  return res.status(404).json({ error: err.message, code: err.code })
}

// Reply directly to an existing GitHub review comment thread.
// Bypasses the draft review entirely — posted to GitHub immediately.
router.post('/comments/reply', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { pull_request_id, reply_to_github_comment_id, body } = req.body

    if (!pull_request_id || !reply_to_github_comment_id || !body) {
      return res.status(400).json({
        error: 'pull_request_id, reply_to_github_comment_id, and body are all required',
      })
    }

    const { repository, pullRequest } = await assertPullRequestAccess(user.id, pull_request_id)

    const credential = await getWriteCredential(user)

    const result = await replyToComment(
      credential,
      pullRequest.github_pr_number,
      repository.github_owner,
      repository.github_repo,
      reply_to_github_comment_id,
      body
    )

    // Persist to database
    const savedComment = await GithubComment.create({
      user_id: user.id,
      pull_request_id: pull_request_id,
      github_thread_id: result.in_reply_to_id?.toString() || null,
      github_comment_id: String(result.id),
      content: {
        body: result.body,
        diff_hunk: result.diff_hunk,
        html_url: result.html_url,
        avatar_url: result.user.avatar_url,
      },
      attachments: {},
      code_anchor: {
        commit_sha: result.commit_id,
        file_path: result.path,
        line_start: result.start_line || result.original_start_line || 0,
        start_side: result.start_side || 'RIGHT',
        line_end: result.line || result.original_line || 0,
        end_side: result.side || 'RIGHT',
      },
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    })

    const serializedComment: SerializedComment = {
      id: savedComment.id,
      thread_id: null,
      pull_request_id,
      user_id: user.id,
      origin: 'github',
      agent_type: null,
      status: 'active',
      content: {
        body: result.body,
        body_html: null,
        diff_hunk: null,
      },
      attachments: {},
      code_anchor: {
        commit_sha: result.commit_id,
        file_path: result.path,
        line_start: result.start_line || result.original_start_line || 0,
        start_side: result.start_side || 'RIGHT',
        line_end: result.line || result.original_line || 0,
        end_side: result.side || 'RIGHT',
      },
      user_display_name: user.github_username || user.display_name || 'Unknown',
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    }

    return res.status(201).json({ comment: serializedComment })
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return credentialErrorResponse(res, error)
    }
    logger.error('Error posting reply:', error)

    if ((error as Error).message === 'Access denied or resource not found') {
      return res.status(403).json({
        error: 'Access denied or pull request not found',
      })
    }

    return res.status(500).json({
      error: 'Failed to post reply',
      message: (error as Error).message,
    })
  }
})

// Create a standalone comment on a diff line (not part of a review).
// Equivalent to clicking a line in the GitHub diff and posting a comment.
router.post('/comments/diff', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { pull_request_id, body, commit_sha, path, line, side, start_line, start_side } = req.body

    if (!pull_request_id || !body || !commit_sha || !path || !line) {
      return res.status(400).json({
        error: 'pull_request_id, body, commit_sha, path, and line are all required',
      })
    }

    const validSides = ['LEFT', 'RIGHT']
    if (side && !validSides.includes(side)) {
      return res.status(400).json({
        error: `side must be one of: ${validSides.join(', ')}`,
      })
    }

    const { repository, pullRequest } = await assertPullRequestAccess(user.id, pull_request_id)

    const credential = await getWriteCredential(user)

    const result = await createDiffComment(
      credential,
      repository.github_owner,
      repository.github_repo,
      pullRequest.github_pr_number,
      {
        body,
        commit_id: commit_sha,
        path,
        line,
        side: side || 'RIGHT',
        ...(start_line != null && {
          start_line,
          start_side: start_side || 'RIGHT',
        }),
      }
    )

    // Persist to database
    const savedComment = await GithubComment.create({
      user_id: user.id,
      pull_request_id: pull_request_id,
      github_thread_id: null,
      github_comment_id: String(result.id),
      content: {
        body: result.body,
        diff_hunk: result.diff_hunk,
        html_url: result.html_url,
        avatar_url: result.user.avatar_url,
      },
      attachments: {},
      code_anchor: {
        commit_sha: result.commit_id,
        file_path: result.path,
        line_start: result.start_line || result.line,
        start_side: result.start_side || result.side || 'RIGHT',
        line_end: result.line,
        end_side: result.side || 'RIGHT',
      },
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    })

    const serializedComment: SerializedComment = {
      id: savedComment.id,
      thread_id: null,
      pull_request_id,
      user_id: user.id,
      user_display_name: user.github_username || user.display_name || 'Unknown',
      origin: 'github',
      agent_type: null,
      status: 'active',
      content: {
        body: result.body,
        body_html: null,
        diff_hunk: null,
      },
      attachments: {},
      code_anchor: {
        commit_sha: result.commit_id,
        file_path: result.path,
        line_start: result.start_line || result.line,
        start_side: result.start_side || result.side || 'RIGHT',
        line_end: result.line,
        end_side: result.side || 'RIGHT',
      },
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    }

    return res.status(201).json({ comment: serializedComment })
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return credentialErrorResponse(res, error)
    }
    logger.error('Error creating diff comment:', error)

    if ((error as Error).message === 'Access denied or resource not found') {
      return res.status(403).json({
        error: 'Access denied or pull request not found',
      })
    }

    return res.status(500).json({
      error: 'Failed to create diff comment',
      message: (error as Error).message,
    })
  }
})

export default router
