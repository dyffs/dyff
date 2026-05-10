<template>
  <div class="mb-2 flex flex-col gap-2 overflow-y-auto">
    <div ref="scrollContainerRef" class="flex-1 overflow-y-auto">
      <CodeComment
        v-for="(comment, index) in thread.comments"
        ref="codeCommentRefs"
        :key="comment.id"
        :comment="comment"
        :is-thread="index > 0"
        :thread-id="threadId"
        :always-expanded="alwaysExpanded"
        :show-diff-hunk="showDiffHunk"
        :show-thread-header="showThreadHeader"
        class="mb-3"
        @select-file="$emit('select-file', $event)"
      />
    </div>  
    <CommentInput
      v-show="!isCollapsed"
      ref="commentInputRef"
      :username="githubUsername"
      :loading="isReplying"
      mode="reply-only"
      :is-replying="isReplying"
      @reply="handleReply"
    />
  </div>
</template>

<script setup lang="ts">
import CodeComment from './CodeComment.vue'
import CommentInput from './CommentInput.vue'
import type { CommentThread } from './types'
import type { DiffNavigateEvent } from '@/types'
import { ref, useTemplateRef, computed, nextTick } from 'vue'
import { useCommentConfig } from './useCommentConfig'
import { useAccount } from '@/modules/account/useAccount'
import { useCommentSystem } from './useCommentSystem'
import { toast } from 'vue-sonner'

interface Props {
  thread: CommentThread
  threadId: string
  alwaysExpanded?: boolean
  showDiffHunk?: boolean
  showThreadHeader?: boolean
  generateCommentId?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  alwaysExpanded: false,
  showDiffHunk: true,
  generateCommentId: false,
  showThreadHeader: true,
})

const commentInputRef = useTemplateRef<InstanceType<typeof CommentInput>>('commentInputRef')

const { replyComment } = useCommentSystem()!

const { githubUsername } = useAccount()!

const config = useCommentConfig()!

const { isCollapsed: checkCollapsed } = config

const isCollapsed = computed(() => props.alwaysExpanded ? false : checkCollapsed(props.threadId))

const isReplying = ref(false)

const scrollContainerRef = useTemplateRef<HTMLElement>('scrollContainerRef')

async function handleReply (content: string) {
  isReplying.value = true
  try {
    await replyComment({
      parent_comment_id: props.threadId,
      body: content,
    })
    commentInputRef.value?.clear()
    await nextTick()
    const container = scrollContainerRef.value
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  } catch (error) {
    toast.error(`Failed to reply to comment: ${(error as Error).message}`)
    console.error('Error replying to comment:', error)
  } finally {
    isReplying.value = false
  }
}

defineEmits<{
  'select-file': [event: DiffNavigateEvent]
}>()

const codeCommentRefs = useTemplateRef<InstanceType<typeof CodeComment>[]>('codeCommentRefs')

defineExpose({
  codeCommentRefs,
})
</script>
