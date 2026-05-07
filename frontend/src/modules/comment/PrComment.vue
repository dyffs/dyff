<template>
  <div class="overflow-x-hidden">
    <template v-if="sortedThreadIds.length > 0">
      <div
        v-if="sortedThreadIds.length === 0"
        class="text-sm text-muted-foreground text-center"
      >
        No comments yet
      </div>

      <div
        v-for="threadId in sortedThreadIds"
        :key="threadId"
        class="oveflow-x-hidden pb-2 hover:bg-neutral-50"
      >
        <ThreadSidebar
          :thread-id="threadId"
          @select-file="handleSelectFile"
        />
      </div>
    </template>
    <CommentInput
      ref="commentInputRef"
      :username="currentUsername"
      :loading="isReplying"
      mode="reply-only"
      class="mt-2"
      @reply="handleReply"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import ThreadSidebar from './ThreadSidebar.vue'
import { useCommentSystem } from './useCommentSystem'
import type { DiffNavigateEvent } from '@/types'
import { usePullRequest } from '../pull_request/usePullRequest'
import type { SerializedPullRequest } from '@/types'
import CommentInput from './CommentInput.vue'

const props = defineProps<{
  pr: SerializedPullRequest
}>()

const { threadMap, postComment } = useCommentSystem()!

const prState = usePullRequest()!
const { currentUsername } = prState

const sortedThreadIds = computed(() => {
  const ids = Object.keys(threadMap.value)

  ids.sort((a, b) => {
    const aFirst = threadMap.value[a]?.value.comments[0]
    const bFirst = threadMap.value[b]?.value.comments[0]
    if (!aFirst || !bFirst) return 0
    return new Date(aFirst.created_at).getTime() - new Date(bFirst.created_at).getTime()
  })

  return ids
})

const isReplying = ref(false)
const commentInputRef = useTemplateRef<InstanceType<typeof CommentInput>>('commentInputRef')

async function handleReply (content: string) {
  if (!props.pr) return

  isReplying.value = true
  try {
    await postComment({
      pull_request_id: props.pr.id,
      content,
    })
    commentInputRef.value?.clear()
  } finally {
    isReplying.value = false
  }
}

const emit = defineEmits<{
  (e: 'select-file', event: DiffNavigateEvent): void
}>()

const handleSelectFile = (event: DiffNavigateEvent) => {
  emit('select-file', event)
}
</script>
