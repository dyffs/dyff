import { requestContext } from '@/service/requestContext'
import { Request, Response } from 'express'
import express from 'express'
import FileReview from '@/database/file_review'
import { assertPullRequestAccess } from '@/service/permission_service'
import { logger } from '@/service/logger'

const router = express.Router()

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { pr_id } = req.query

    if (!pr_id || typeof pr_id !== 'string') {
      return res.status(400).json({
        error: 'pr_id query parameter is required'
      })
    }

    // Check permission: pull request -> repository -> repository tracking
    const { pullRequest } = await assertPullRequestAccess(user.id, pr_id)

    // Fetch file review for this user and pull request
    const fileReview = await FileReview.findOne({
      where: {
        user_id: user.id,
        pull_request_id: pullRequest.id,
      },
    })

    if (!fileReview) {
      return res.status(200).json({
        review_data: {},
        text_note: {},
        bookmarks: [],
      })
    }

    return res.status(200).json({
      review_data: fileReview.review_data as Record<string, { content_hash: string }>,
      text_note: fileReview.notes.text_note as object,
      bookmarks: fileReview.notes.bookmarks as object[],
    })
  } catch (error) {
    logger.error('Error fetching file review:', error)

    if ((error as Error).message === 'Access denied or resource not found') {
      return res.status(403).json({
        error: 'Access denied or pull request not found'
      })
    }

    return res.status(500).json({
      error: 'Failed to fetch file review',
      message: (error as Error).message,
    })
  }
})

router.post('/:prId', async (req: Request, res: Response) => {
  try {
    const user = requestContext.currentUser()
    const { prId } = req.params
    const { review_data, text_note, bookmarks } = req.body

    // Validate that at least one field is provided
    if (!review_data && !text_note && !bookmarks) {
      return res.status(400).json({
        error: 'At least one of review_data, notes, or bookmarks must be provided'
      })
    }

    // Validate types if provided
    if (review_data !== undefined && typeof review_data !== 'object') {
      return res.status(400).json({
        error: 'review_data must be an object'
      })
    }

    if (text_note !== undefined && typeof text_note !== 'object') {
      return res.status(400).json({
        error: 'text_note must be an object'
      })
    }

    if (bookmarks !== undefined && !Array.isArray(bookmarks)) {
      return res.status(400).json({
        error: 'bookmarks must be an array'
      })
    }

    // Check permission: pull request -> repository -> repository tracking
    const { pullRequest } = await assertPullRequestAccess(user.id, prId)

    let fileReview = await FileReview.findOne({
      where: {
        user_id: user.id,
        pull_request_id: pullRequest.id,
      },
    })

    if (fileReview && fileReview.user_id !== user.id) {
      return res.status(403).json({
        error: 'You are not authorized to update this file review'
      })
    }

    if (!fileReview) {
      fileReview = await FileReview.create({
        team_id: user.team_id,
        user_id: user.id,
        pull_request_id: pullRequest.id,
        review_data: review_data,
        notes: {
          text_note: text_note,
          bookmarks: bookmarks,
        },
      })
    } else {
      if (review_data !== undefined) {
        fileReview.review_data = review_data
        fileReview.changed('review_data', true)
      }
      if (text_note !== undefined || bookmarks !== undefined) {
        fileReview.notes = {
          ...fileReview.notes,
          ...(text_note !== undefined && { text_note }),
          ...(bookmarks !== undefined && { bookmarks }),
        }
        fileReview.changed('notes', true)
      }
      await fileReview.save()
    }

    return res.status(200).json({
      review_data: fileReview.review_data,
      notes: fileReview.notes,
    })
  } catch (error) {
    logger.error('Error updating file review:', error)

    if ((error as Error).message === 'Access denied or resource not found') {
      return res.status(403).json({
        error: 'Access denied or pull request not found'
      })
    }

    return res.status(500).json({
      error: 'Failed to update file review',
      message: (error as Error).message,
    })
  }
})

export default router
