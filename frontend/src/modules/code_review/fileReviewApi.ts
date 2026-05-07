import apiClient from '@/modules/apiClient'
import type { CodeBookmark, Notes, ReviewData } from '@/types'

export interface FileReviewData {
  review_data: ReviewData
  text_notes?: Notes
  bookmarks?: CodeBookmark[]
}

async function getFileReview (prId: string): Promise<FileReviewData> {
  const response = await apiClient.get<FileReviewData>('/file_reviews', {
    params: { pr_id: prId }
  })
  return response.data
}

async function updateFileReview (
  prId: string,
  reviewData: Record<string, { content_hash: string }>,
  notes?: Notes,
  bookmarks?: CodeBookmark[]
): Promise<FileReviewData> {
  const response = await apiClient.post<FileReviewData>(`/file_reviews/${prId}`, {
    review_data: reviewData,
    text_notes: notes,
    bookmarks: bookmarks
  })
  return response.data
}

export { getFileReview, updateFileReview }
