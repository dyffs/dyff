<template>
  <div v-if="thread">
    <ThreadCommentCard
      :thread="thread"
      :show-diff-hunk="showDiffHunk"
      :agent-session-id="agentSessionId"
      @open-thread="openPopup(threadId)"
      @select-file="$emit('select-file', $event)"
    />
    <!-- <ThreadSidebarPanel
      :thread="thread"
      :agent-session-id="agentSessionId"
      :is-open="isOpen"
      @close="close()"
    /> -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="popupRef"
        class="w-[420px] max-h-[550px] overflow-y-auto shadow-lg
        rounded-md bg-white border border-border z-50 flex flex-col gap-2"
        :style="popupStyle"
      >
        <!-- Different threads on the same line -->
        <CommentThread
          v-if="thread"
          :key="thread.id"
          :thread="thread"
          :thread-id="thread.id"
          always-expanded
          :show-diff-hunk="false"
          :show-thread-header="true"
          class="last:border-b-0"
          @select-file="$emit('select-file', $event)"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
import type { DiffNavigateEvent } from '@/types'
import ThreadCommentCard from './ThreadCommentCard.vue'
import { useActiveThreadSidebar } from './useActiveThreadSidebar'
import { useCommentSystem } from './useCommentSystem'
import CommentThread from './CommentThread.vue'

interface Props {
  threadId: string
  showDiffHunk?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showDiffHunk: true,
})

const { threadMap, rootIndex } = useCommentSystem()!
const thread = threadMap.value[props.threadId]

const rootMeta = computed(() => rootIndex.value.find(r => r.id === props.threadId))
const agentSessionId = computed(() => {
  const meta = rootMeta.value
  return meta?.agent_chat_session_status === 'running' ? meta.agent_chat_session_id : undefined
})

defineEmits<{
  'select-file': [event: DiffNavigateEvent]
}>()

const isOpen = ref(false)

function openPopup (threadId: string) {
  isOpen.value = true
}

const popupStyle = ref<CSSProperties>({
  position: 'absolute',
  top: '0',
  left: '0',
})

const { activeThreadId, open, close } = useActiveThreadSidebar()
// const isOpen = computed(() => activeThreadId.value === props.threadId)

</script>
