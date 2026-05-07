<template>
  <Teleport to="body">
    <Transition name="thread-sidebar">
      <div
        v-if="isOpen"
        class="fixed inset-y-0 left-0 z-50 flex flex-col w-[620px] bg-white border-l shadow-xl"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h2 class="font-semibold text-sm">
            Threads
          </h2>
          <button
            class="rounded p-1 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors"
            @click="$emit('close')"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <!-- Thread comments -->
        <div class="flex-1 overflow-y-auto divide-y divide-neutral-100">
          <div
            v-for="(comment, index) in refProps.thread.value.comments"
            :key="comment.id"
            class="px-4 py-3"
          >
            <SidebarCommentItem
              :agent-session-id="agentSessionId"
              :comment="comment"
              :show-diff-hunk="index === 0"
            />
          </div>
        </div>

        <!-- Reply input -->
        <div class="shrink-0">
          <CommentInput
            ref="commentInputRef"
            :username="currentUsername"
            :loading="isReplying"
            mode="reply-only"
            @reply="handleReply"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, toRefs, useTemplateRef } from 'vue'
import { X } from 'lucide-vue-next'
import type { CommentThread } from './types'
import { useCommentSystem } from './useCommentSystem'
import { usePullRequest } from '../pull_request/usePullRequest'
import SidebarCommentItem from './SidebarCommentItem.vue'
import CommentInput from './CommentInput.vue'

interface Props {
  thread: CommentThread
  isOpen: boolean
  agentSessionId: string | undefined
}

const props = defineProps<Props>()
const refProps = toRefs(props)

defineEmits<{ close: [] }>()

const prState = usePullRequest()!
const { currentUsername } = prState
const { postComment, activePullRequestId } = useCommentSystem()!

const isReplying = ref(false)
const commentInputRef = useTemplateRef<InstanceType<typeof CommentInput>>('commentInputRef')

async function handleReply (content: string) {
  if (!activePullRequestId.value) return
  isReplying.value = true
  try {
    await postComment({
      pull_request_id: activePullRequestId.value,
      thread_id: refProps.thread.value.id,
      content,
    })
    commentInputRef.value?.clear()
  } finally {
    isReplying.value = false
  }
}
</script>

<style scoped>
.thread-sidebar-enter-active,
.thread-sidebar-leave-active {
  transition: transform 0.2s ease;
}

.thread-sidebar-enter-from,
.thread-sidebar-leave-to {
  transform: translateX(-100%);
}
</style>
