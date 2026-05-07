import { createInjectionState, useDebounceFn } from '@vueuse/core'
import { ref } from 'vue'
import { getFileReview, updateFileReview } from './fileReviewApi'
import type { ReviewData, Notes, CodeBookmark, FileDiff } from '@/types'
import { computeFileHash } from '@/utils/hash'

const [useProvideCodeReview, useCodeReview] = createInjectionState(() => {
  const files = ref<FileDiff[]>([])
  const fileReviews = ref<ReviewData>({})
  const notes = ref<Notes>({ type: 'doc', content: [] })
  const bookmarks = ref<CodeBookmark[]>([])
  const isLoading = ref(false)
  const isSyncing = ref(false)
  const currentPrId = ref<string | null>(null)

  async function loadFileReviews (prId: string): Promise<void> {
    isLoading.value = true
    currentPrId.value = prId
    try {
      const data = await getFileReview(prId)
      fileReviews.value = data.review_data
      notes.value = data.text_notes || { type: 'doc', content: [] }
      bookmarks.value = data.bookmarks || []

    } catch (error) {
      console.error('Failed to load file reviews:', error)
      fileReviews.value = {}
      notes.value = { type: 'doc', content: [] }
    } finally {
      isLoading.value = false
    }
  }

  async function syncFileReviews (prId: string): Promise<void> {
    isSyncing.value = true
    try {
      // Compute current hashes for all files
      const currentHashes: Record<string, string> = {}

      for (const file of files.value) {
        const hash = await computeFileHash(file)
        currentHashes[file.newPath] = hash
      }

      // Compare with stored reviews to detect outdated reviews
      let hasChanges = false
      const newReviews: Record<string, { content_hash: string }> = {}

      // Keep only reviews where content hasn't changed
      for (const [filePath, reviewData] of Object.entries(fileReviews.value)) {
        const currentHash = currentHashes[filePath]

        if (currentHash && currentHash === reviewData.content_hash) {
          // File still exists and content unchanged, keep the review
          newReviews[filePath] = reviewData
        } else {
          // File deleted or content changed, remove the review
          hasChanges = true
        }
      }

      // Update local state
      fileReviews.value = newReviews

      // Persist to backend if there were changes (outdated reviews removed)
      if (hasChanges) {
        await updateFileReview(prId, newReviews, notes.value, bookmarks.value)
      }
    } catch (error) {
      console.error('Failed to sync file reviews:', error)
    } finally {
      isSyncing.value = false
    }
  }

  async function toggleFileReviewed (filePath: string): Promise<void> {
    if (!currentPrId.value) return

    const file = files.value.find(f => f.newPath === filePath)
    if (!file) return

    const wasReviewed = filePath in fileReviews.value
    const updatedReviews = { ...fileReviews.value }

    // Toggle: if reviewed, unmark it; if not reviewed, mark it
    if (wasReviewed) {
      // Currently reviewed, unmark it
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete updatedReviews[filePath]
    } else {
      // Not reviewed, mark it with current hash
      const hash = await computeFileHash(file)
      updatedReviews[filePath] = { content_hash: hash }
    }

    try {
      // Optimistically update UI
      fileReviews.value = updatedReviews

      // Auto-collapse when marking as reviewed, expand when unmarking
      file.isExpanded = wasReviewed

      // Persist to backend
      await updateFileReview(currentPrId.value, updatedReviews, notes.value, bookmarks.value)
    } catch (error) {
      console.error('Failed to toggle file reviewed:', error)
      // Revert on error by triggering a re-load
      await loadFileReviews(currentPrId.value)
    }
  }

  function isFileReviewed (filePath: string): boolean {
    return filePath in fileReviews.value
  }

  function getFileByPath (filePath: string): FileDiff | undefined {
    return files.value.find(f => f.newPath === filePath)
  }

  function getReviewedCount (): number {
    return Object.keys(fileReviews.value).length
  }

  // Debounced function to save notes
  const debouncedSaveNotes = useDebounceFn(async (prId: string, notesContent: Notes, bookmarksContent: CodeBookmark[]) => {
    try {
      await updateFileReview(prId, fileReviews.value, notesContent, bookmarksContent)
    } catch (error) {
      console.error('Failed to save notes:', error)
    }
  }, 1000)

  function updateNotes (notesContent: Notes): void {
    notes.value = notesContent
    if (currentPrId.value) {
      debouncedSaveNotes(currentPrId.value, notesContent, bookmarks.value)
    }
  }

  function updateBookmarks (bookmarksContent: CodeBookmark[]): void {
    bookmarks.value = bookmarksContent
    if (currentPrId.value) {
      debouncedSaveNotes(currentPrId.value, notes.value, bookmarksContent)
    }
  }

  return {
    files,
    fileReviews,
    notes,
    bookmarks,
    isLoading,
    isSyncing,
    loadFileReviews,
    syncFileReviews,
    toggleFileReviewed,
    isFileReviewed,
    getFileByPath,
    getReviewedCount,
    updateNotes,
    updateBookmarks,
  }
})

export { useProvideCodeReview, useCodeReview }