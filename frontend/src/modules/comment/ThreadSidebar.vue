<template>
  <div v-if="thread">
    <ThreadCommentCard
      :thread="thread"
      :show-diff-hunk="showDiffHunk"
      :agent-session-id="agentSessionId"
      @open-thread="open(threadId)"
      @select-file="$emit('select-file', $event)"
    />
    <ThreadSidebarPanel
      :thread="thread"
      :agent-session-id="agentSessionId"
      :is-open="isOpen"
      @close="close()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DiffNavigateEvent } from '@/types'
import ThreadCommentCard from './ThreadCommentCard.vue'
import ThreadSidebarPanel from './ThreadSidebarPanel.vue'
import { useActiveThreadSidebar } from './useActiveThreadSidebar'
import { useCommentSystem } from './useCommentSystem'

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

const { activeThreadId, open, close } = useActiveThreadSidebar()
const isOpen = computed(() => activeThreadId.value === props.threadId)
</script>
