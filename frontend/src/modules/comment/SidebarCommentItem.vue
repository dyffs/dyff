<template>
  <div>
    <!-- Comment header: avatar + username + time -->
    <div class="flex items-center gap-2 mb-2">
      <UnifiedAvatar
        :origin="comment.origin"
        :name="comment.origin === 'human' ? comment.user_display_name : comment.agent_type"
      />
      <span class="font-medium text-sm">{{ comment.origin === 'human' ? comment.user_display_name : comment.agent_type }}</span>
      <span
        v-tooltip.top="comment.created_at"
        class="text-xs text-muted-foreground"
      >
        {{ getTimeAgo(comment.created_at) }}
      </span>
    </div>

    <!-- Diff hunk -->
    <DiffHunkDisplay
      v-if="showDiffHunk && comment.content.diff_hunk"
      :diff-hunk="comment.content.diff_hunk"
      :max-lines="8"
      class="mb-3 text-xs"
    />

    <!-- Comment body -->
    <div
      v-if="comment.content.body"
      class="sidebar-markdown text-sm prose prose-sm max-w-none dark:prose-invert
        text-neutral-900 wrap-anywhere
        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline"
      v-html="renderedHtml"
    />

    <!-- Agent progress indicator -->
    <AgentProgressIndicator
      v-if="canShowProgress"
      :progress="agentProgress"
    />
  </div>
</template>

<script setup lang="ts">
import type { AppComment } from '@/types'
import { getTimeAgo } from '@/lib/utils'
import { useMarkdownRenderer } from '@/utils/markdownRendererGithub'
import DiffHunkDisplay from './DiffHunkDisplay.vue'
import UnifiedAvatar from '@/components/custom/UnifiedAvatar.vue'
import AgentProgressIndicator from '../agent/AgentProgressIndicator.vue'
import { computed } from 'vue'
import { useCommentSystem } from './useCommentSystem'

interface Props {
  comment: AppComment
  agentSessionId: string | undefined
  showDiffHunk?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showDiffHunk: false,
})

const commentSystem = useCommentSystem()

const canShowProgress = computed(() => {
  return props.agentSessionId && props.comment.origin === 'ai_agent'
})

const agentProgress = computed(() => {
  if (!props.agentSessionId || !commentSystem) return null
  // touch progressMap so this stays reactive across polls
  void commentSystem.progressMap.value
  return commentSystem.getProgress(props.agentSessionId) ?? null
})

const { renderedHtml } = useMarkdownRenderer(() => ({
  markdown: props.comment.content.body ?? '',
  preRenderedHtml: '',
}))
</script>

<style scoped>
.sidebar-markdown :deep(h1),
.sidebar-markdown :deep(h2),
.sidebar-markdown :deep(h3) {
  color: rgb(23 23 23);
  font-weight: 600;
}

.sidebar-markdown :deep(h1) {
  font-size: 15px;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.sidebar-markdown :deep(h2) {
  font-size: 15px;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.sidebar-markdown :deep(h3) {
  font-size: 14px;
  margin-top: 0.75rem;
  margin-bottom: 0.4rem;
}

.sidebar-markdown :deep(h4) {
  font-size: 14px;
  margin-top: 0.75rem;
  margin-bottom: 0.4rem;
}

.sidebar-markdown :deep(p) {
  margin-top: 0.35rem;
  margin-bottom: 0.35rem;
  line-height: 1.4rem;
}

.sidebar-markdown :deep(code) {
  background: rgb(244, 244, 244);
  border: 1px solid rgb(229 229 229);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.125rem 0.375rem;
}

.sidebar-markdown :deep(pre) {
  background: rgb(245 245 245);
  border: 1px solid rgb(229 229 229);
  border-radius: 0.5rem;
  color: rgb(38 38 38);
  font-size: 0.75rem;
  line-height: 1.35rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.75rem;
  white-space: pre-wrap;
  overflow-x: auto;
}

.sidebar-markdown :deep(pre code) {
  background: transparent;
  border: 0;
  border-radius: 0;
  font-size: inherit;
  font-weight: 400;
  padding: 0;
}
</style>
