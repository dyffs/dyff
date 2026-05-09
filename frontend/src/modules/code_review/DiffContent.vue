<template>
  <div
    v-if="isFetchingDiff"
    class="h-full flex items-center justify-center"
  >
    <div class="flex items-center gap-1">
      <Spinner class="size-3 text-muted-foreground" />
      <span class="text-sm text-muted-foreground">Loading diff...</span>
    </div>
  </div>

  <div
    v-else-if="files.length > 0"
    ref="scrollContainerRef"
    class="h-full overflow-y-auto bg-tertiary-foreground"
    @mouseup="onDiffMouseUp"
    @scroll.passive="onScrollHandler"
  >
    <div class="p-4 mb-20">
      <FileCard
        v-for="file in files"
        :key="file.id"
        :file="file"
        :diff-mode="diffMode"
        :is-file-reviewed="isFileReviewed"
        :get-threads-for-line="getThreadsForLine"
        @toggle-file-expanded="$emit('toggle-file-expanded', $event)"
        @toggle-file-reviewed="$emit('toggle-file-reviewed', $event)"
        @select-file="$emit('select-file', $event)"
      />

      <div class="text-xs text-muted-foreground text-center py-2 pt-4">
        -- No more changes --
      </div>
    </div>
  </div>

  <div
    v-else
    class="h-full flex items-center justify-center text-muted-foreground"
  >
    No changes to display
  </div>

  <DiffContextMenu />
  <DiffCommentPopup />
  <DiffTextContextMenu />
</template>

<script setup lang="ts">
import { ref, watch, type Ref } from 'vue'

import { Spinner } from '@/components/ui/spinner'

import { type CommentThread } from '@/modules/comment/types'

import FileCard from './diff/FileCard.vue'

import type { FileDiff, AppComment, DiffNavigateEvent } from '@/types'
import { computed } from 'vue'
import { useProvideContextMenu } from './diff_menu/useContextMenu'
import DiffContextMenu from './diff_menu/DiffContextMenu.vue'
import DiffCommentPopup from './diff_menu/DiffCommentPopup.vue'
import { useProvideDiffTextSelection } from './diff_menu/useDiffTextSelection'
import DiffTextContextMenu from './diff_menu/DiffTextContextMenu.vue'
import { useVirtualDiffScroller } from './diff/useVirtualDiffScroller'
import { useCommentSystem } from '@/modules/comment/useCommentSystem'

useProvideContextMenu()
const textSelection = useProvideDiffTextSelection()
const { show: showTextMenu, hide: hideTextMenu, isOpen: isTextMenuOpen } = textSelection

const scroller = useVirtualDiffScroller()!
const scrollContainerRef = ref<HTMLElement | null>(null)

// Bind the scroll container to the scroller when it appears
watch(scrollContainerRef, (el) => {
  scroller.containerRef.value = el
})

function onScrollHandler () {
  scroller.onScroll()
  if (isTextMenuOpen.value) hideTextMenu()
}

function onDiffMouseUp () {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) {
    hideTextMenu()
    return
  }

  const text = selection.toString().trim()
  if (!text) {
    hideTextMenu()
    return
  }

  // Check that the selection originates from a diff line content span
  const anchorNode = selection.anchorNode
  const anchorEl = anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement
  if (!anchorEl?.closest('.diff-line-content')) {
    hideTextMenu()
    return
  }

  const range = selection.getRangeAt(0)
  showTextMenu(text, range)
}

interface Props {
  files: FileDiff[]
  isFetchingDiff: boolean
  isFileReviewed: (path: string) => boolean
  diffMode: 'inline' | 'split'
}

defineProps<Props>()

defineEmits<{
  'toggle-file-expanded': [fileId: string]
  'toggle-file-reviewed': [fileId: string]
  'select-file': [event: DiffNavigateEvent]
}>()

const { threadMap } = useCommentSystem()!

interface LineThread {
  thread: CommentThread
  threadId: string
  rootComment: AppComment
  replyCount: number
}

// Build lookup map: "filePath:side:lineNumber" -> LineThread[]
const threadsByLine = computed(() => {
  const map = new Map<string, LineThread[]>()

  if (!threadMap.value) return map

  const threads = Object.values(threadMap.value)

  for (const threadRef of threads) {
    const rootComment = threadRef.value.comments[0]
    if (!rootComment?.code_anchor) continue  // Skip general PR comments

    const anchor = rootComment.code_anchor
    const key = `${anchor.file_path}:${anchor.end_side}:${anchor.line_end}`

    const lineThread: LineThread = {
      thread: threadRef.value,
      threadId: threadRef.value.id,
      rootComment,
      replyCount: threadRef.value.comments.length - 1
    }

    const existing = map.get(key)
    if (existing) {
      existing.push(lineThread)
    } else {
      map.set(key, [lineThread])
    }
  }

  return map
})

function getThreadsForLine (filePath: string, side: 'LEFT' | 'RIGHT', lineNumber: number | undefined): LineThread[] {
  if (!lineNumber) return []
  return threadsByLine.value.get(`${filePath}:${side}:${lineNumber}`) ?? []
}
</script>
