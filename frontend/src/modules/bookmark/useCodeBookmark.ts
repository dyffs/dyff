import { createInjectionState } from '@vueuse/core'
import { ref, computed } from 'vue'
import { useCodeReview } from '@/modules/code_review/useCodeReview'
import type { CodeBookmark, FileDiff } from '@/types'
import { computeFileHash } from '@/utils/hash'

export const [useProvideCodeBookmark, useCodeBookmark] = createInjectionState(() => {
  const isVisible = ref(false)
  const highlightedBookmarkId = ref<string | null>(null)
  const codeReview = useCodeReview()!
  const hoveredBookmark = ref<CodeBookmark | null>(null)
  const pinnedBookmark = ref<CodeBookmark | null>(null)

  // Add a bookmark, check the code_anchor to find existing bookmark, if not, add a new one
  async function addBookmark (params: {
    fileDiff: FileDiff
    lineStart: number
    lineEnd?: number
    side: 'old' | 'new'
    description?: string
  }) {
    const { fileDiff, lineStart, lineEnd = lineStart, side, description = '' } = params

    // Compute content hash from file diff
    const contentHash = await computeFileHash(fileDiff)

    // Determine file path based on diff status
    const filePath = fileDiff.status === 'deleted' ? fileDiff.oldPath : fileDiff.newPath

    // Create code anchor based on side
    const codeAnchor: CodeBookmark['code_anchor'] = {
      file_path: filePath,
      content_hash: contentHash,
      ...side === 'old'
        ? {
          old_line_start: lineStart,
          old_line_end: lineEnd
        }
        : {
          new_line_start: lineStart,
          new_line_end: lineEnd
        }
    }

    // Work with current bookmarks from codeReview
    const currentBookmarks = [...codeReview.bookmarks.value]

    // Check for existing bookmark with same anchor
    const existingBookmark = currentBookmarks.find(b =>
      b.code_anchor.file_path === codeAnchor.file_path &&
      b.code_anchor.content_hash === codeAnchor.content_hash &&
      b.code_anchor.old_line_start === codeAnchor.old_line_start &&
      b.code_anchor.old_line_end === codeAnchor.old_line_end &&
      b.code_anchor.new_line_start === codeAnchor.new_line_start &&
      b.code_anchor.new_line_end === codeAnchor.new_line_end
    )

    if (existingBookmark) {
      // open the existing bookmark
      pinnedBookmark.value = existingBookmark
    } else {
      // Add new bookmark
      const newBookmark: CodeBookmark = {
        id: crypto.randomUUID(),
        file_diff_id: fileDiff.id,
        code_anchor: codeAnchor,
        description,
        updated_at: new Date().toISOString()
      }
      currentBookmarks.push(newBookmark)

      // Not pinned by default seems to be better UX
      // pinnedBookmark.value = newBookmark
    }

    // Persist via codeReview
    codeReview.updateBookmarks(currentBookmarks)
  }

  // Delete a bookmark
  function removeBookmark (id: string) {
    const currentBookmarks = codeReview.bookmarks.value.filter(b => b.id !== id)
    codeReview.updateBookmarks(currentBookmarks)
  }

  // Update a bookmark
  function updateBookmark (id: string, updates: Partial<Omit<CodeBookmark, 'id'>>) {
    const currentBookmarks = [...codeReview.bookmarks.value]
    const bookmark = currentBookmarks.find(b => b.id === id)
    if (bookmark) {
      Object.assign(bookmark, updates, { updated_at: new Date().toISOString() })
      codeReview.updateBookmarks(currentBookmarks)
    }
  }

  // Highlight a bookmark
  function setHighlightedBookmark (id: string | null) {
    highlightedBookmarkId.value = id
  }

  // Show/hide bookmark bar
  function toggleVisibility () {
    isVisible.value = !isVisible.value
  }

  function setVisibility (visible: boolean) {
    isVisible.value = visible
  }

  // Helper to get bookmark by code anchor
  function getBookmarkByAnchor (anchor: CodeBookmark['code_anchor']) {
    return codeReview.bookmarks.value.find(b =>
      b.code_anchor.file_path === anchor.file_path &&
      b.code_anchor.content_hash === anchor.content_hash &&
      b.code_anchor.old_line_start === anchor.old_line_start &&
      b.code_anchor.old_line_end === anchor.old_line_end &&
      b.code_anchor.new_line_start === anchor.new_line_start &&
      b.code_anchor.new_line_end === anchor.new_line_end
    )
  }

  return {
    bookmarks: computed(() => [...codeReview.bookmarks.value].reverse()),
    isVisible: computed(() => isVisible.value),
    highlightedBookmarkId: computed(() => highlightedBookmarkId.value),
    addBookmark,
    removeBookmark,
    updateBookmark,
    setHighlightedBookmark,
    toggleVisibility,
    setVisibility,
    getBookmarkByAnchor,
    pinnedBookmark,
    hoveredBookmark,
  }
})