<template>
  <div class="">
    <!-- Thread Header -->
    <ThreadHeader
      v-if="!isThread && showThreadHeader"
      :comment="comment"
      :is-collapsed="isCollapsed"
      :always-expanded="alwaysExpanded"
      :show-diff-hunk="showDiffHunk"
      @select-file="$emit('select-file', $event)"
      @toggle-collapse="toggleCollapse"
    />

    <template
      v-if="!isCollapsed"
    >
      <DiffHunkDisplay
        v-if="!isThread && showDiffHunk"
        :max-lines="8"
        :diff-hunk="comment.content.diff_hunk"
        class="mx-4 mt-3 mb-4 text-xs"
      />

      <div class="mb-3 px-4">
        <div
          v-if="showCommentHeader"
          class="flex items-center gap-2 wrap-anywhere mb-2"
        >
          <div class="flex items-center gap-2">
            <GithubAvatar
              :username="comment.user_display_name"
              class="h-5 w-5 ring-1 ring-neutral-300"
            />
            <span class="font-medium text-sm">{{ comment.user_display_name }}</span>
          </div>
          <span
            v-tooltip.top="comment.created_at"
            class="text-xs text-muted-foreground"
          >
            {{ getTimeAgo(comment.created_at) }}
          </span>
        </div>
        <div
          v-if="comment.content.body"
          :class="`prose ${MARKDOWN_STYLES_CLASS}`"
          v-html="renderedHtml"
        />
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import type { AppComment, DiffNavigateEvent } from '@/types'
import { computed } from 'vue'
import { useMarkdownRenderer } from '@/utils/markdownRendererGithub'
import DiffHunkDisplay from './DiffHunkDisplay.vue'
import ThreadHeader from './ThreadHeader.vue'
import { getTimeAgo } from '@/lib/utils'
import GithubAvatar from '@/components/custom/GithubAvatar.vue'
import { useCommentConfig } from './useCommentConfig'
import { MARKDOWN_STYLES_CLASS } from '../common/styles'

defineEmits<{
  (e: 'select-file', event: DiffNavigateEvent): void
}>()

const props = withDefaults(defineProps<{
  comment: AppComment
  isThread: boolean
  threadId: string
  alwaysExpanded?: boolean
  showDiffHunk?: boolean
  showThreadHeader: boolean
}>(), {
  alwaysExpanded: false,
  showDiffHunk: true
})

const config = useCommentConfig()
if (!config) {
  throw new Error('CodeComment must be used within a CommentConfig provider')
}

const { isCollapsed: checkCollapsed, toggleCollapsed } = config

const isCollapsed = computed(() => props.alwaysExpanded ? false : checkCollapsed(props.threadId))

function toggleCollapse () {
  toggleCollapsed(props.threadId)
}

function expandComment () {
  config?.expand(props.threadId)
}


const filePath = computed(() => {
  if (!props.comment.code_anchor) return null

  const path = props.comment.code_anchor.file_path
  return path
})

const showCommentHeader = computed(() => {
  if (!props.isThread && !filePath.value) return false

  return true
})

defineExpose({
  comment: props.comment,
  expandComment
})
const { renderedHtml } = useMarkdownRenderer(() => ({
  markdown: props.comment.content.body ?? '',
  preRenderedHtml: '' // TODO: Add pre-rendered HTML later
}))
</script>