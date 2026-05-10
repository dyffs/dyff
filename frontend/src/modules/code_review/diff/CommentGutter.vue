<template>
  <td class="relative">
    <!-- Single trigger: unique participants across all threads -->
    <div class="absolute top-0 left-0">
      <button
        ref="triggerRef"
        class="inline-flex items-center -space-x-2 px-1.5 py-0.5 rounded text-xs
          hover:bg-muted/50 transition-colors cursor-pointer"
        @click="togglePopup"
      >
        <GithubAvatar
          v-for="username in displayedParticipants"
          :key="username"
          :username="username"
          class="size-4 rounded-full ring-1 ring-white"
        />
        <span
          v-if="extraCount > 0"
          class="size-4 rounded-full ring-1 ring-white bg-neutral-200 text-[9px] font-medium
            flex items-center justify-center text-neutral-600"
        >
          +{{ extraCount }}
        </span>
      </button>
    </div>

    <!-- Floating popup showing all threads -->
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
          v-for="lineThread in threads"
          :key="lineThread.threadId"
          :thread="lineThread.thread"
          :thread-id="lineThread.threadId"
          always-expanded
          :show-diff-hunk="false"
          :show-thread-header="true"
          class="last:border-b-0"
          @select-file="$emit('select-file', $event)"
        />
      </div>
    </Teleport>
  </td>
</template>

<script setup lang="ts">
import GithubAvatar from '@/components/custom/GithubAvatar.vue'
import type { AppComment, DiffNavigateEvent } from '@/types'
import type { CommentThread as ICommentThread } from '@/modules/comment/types'
import CommentThread from '@/modules/comment/CommentThread.vue'
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, type CSSProperties } from 'vue'
import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom'
import { useCommentSystem } from '@/modules/comment/useCommentSystem'

interface LineThread {
  thread: ICommentThread
  threadId: string
  rootComment: AppComment
  replyCount: number
}

interface Props {
  threads: LineThread[]
}

const props = withDefaults(defineProps<Props>(), {
})

defineEmits<{
  'select-file': [event: DiffNavigateEvent]
}>()

const MAX_AVATARS = 2

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const { threadMetaMap } = useCommentSystem()!

const allParticipants = computed(() => {
  const seen = new Set<string>()
  for (const lt of props.threads) {
    const meta = threadMetaMap.value.threadMeta.get(lt.threadId)
    const usernames = meta?.participantUsernames ?? [lt.rootComment.user_display_name]
    for (const u of usernames) seen.add(u)
  }
  return [...seen]
})

const displayedParticipants = computed(() => allParticipants.value.slice(0, MAX_AVATARS))
const extraCount = computed(() => Math.max(0, allParticipants.value.length - MAX_AVATARS))

const triggerRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const popupRef = ref<HTMLElement | null>(null)
const popupStyle = ref<CSSProperties>({
  position: 'absolute',
  top: '0',
  left: '0',
})

function togglePopup () {
  isOpen.value = !isOpen.value
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
