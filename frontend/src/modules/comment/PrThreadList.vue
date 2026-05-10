<template>
  <div v-if="thread">
    <ThreadCommentCard
      :thread="thread"
      :show-diff-hunk="showDiffHunk"
      :agent-session-id="agentSessionId"
      @open-thread="openPopup"
      @select-file="$emit('select-file', $event)"
    />
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
          :show-diff-hunk="true"
          :show-thread-header="true"
          class="last:border-b-0"
          @select-file="$emit('select-file', $event)"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, type CSSProperties } from 'vue'
import type { DiffNavigateEvent } from '@/types'
import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom'
import ThreadCommentCard from './ThreadCommentCard.vue'
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

const triggerRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const popupRef = ref<HTMLElement | null>(null)
const popupStyle = ref<CSSProperties>({
  position: 'absolute',
  top: '0',
  left: '0',
})


function openPopup (e: MouseEvent) {
  triggerRef.value = e.currentTarget as HTMLElement
  isOpen.value = true
}

let cleanupAutoUpdate: (() => void) | null = null

async function updatePopupPosition () {
  if (!triggerRef.value || !popupRef.value) return

  try { 
    const { x, y } = await computePosition(triggerRef.value, popupRef.value, {
      placement: 'top-start',
      middleware: [
        offset(8),
        flip(),
        shift({ padding: 8 })
      ]
    })
    popupStyle.value = {
      position: 'absolute',
      top: `${y}px`,
      left: `${x}px`,
    }
  } catch (error) {
    console.error(error)
  }

  return
}

watch(isOpen, async (open) => {
  cleanupAutoUpdate?.()
  cleanupAutoUpdate = null

  if (!open) return
  await nextTick()
  if (!triggerRef.value || !popupRef.value) return

  cleanupAutoUpdate = autoUpdate(triggerRef.value, popupRef.value, () => void updatePopupPosition())
})

function onDocumentClick (e: MouseEvent) {
  if (!isOpen.value) return
  const target = e.target as Node
  if (popupRef.value?.contains(target)) return
  if (triggerRef.value?.contains(target)) return
  isOpen.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick, true)
  cleanupAutoUpdate?.()
})


</script>
