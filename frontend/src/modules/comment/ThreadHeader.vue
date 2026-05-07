<template>
  <div
    class="flex items-center gap-2 justify-between wrap-anywhere
      text-neutral-800 font-medium bg-neutral-100 px-2 py-1 cursor-pointer"
  >
    <div class="flex-initial">
      <div
        v-if="filePath"
        v-tooltip.top="comment.code_anchor?.file_path"
        class="text-xs flex items-center gap-1 group"
        @click.stop="clickCommentHeader(comment)"
      >
        <GithubAvatar
          v-for="username in participants"
          :key="username"
          :username="username"
          class="h-4 w-4 ring-1 ring-neutral-300"
        />
        <span class="text-xs font-medium group-hover:underline">
          {{ fileName }}
        </span>
        <span class="text-xs text-neutral-400 ml-2">
          {{ lastCommentDate }}
        </span>
      </div>
      <div
        v-else
        class="text-xs flex items-center gap-2"
      >
        <div class="flex items-center gap-1">
          <div class="flex items-center -space-x-1">
            <GithubAvatar
              v-for="username in participants"
              :key="username"
              :username="username"
              class="h-4 w-4 ring-1 ring-neutral-300"
            />
          </div>
          <span
            v-if="participants.length > 0"
            class="font-medium"
          >
            {{ participantsText }}
          </span>
        </div>
        <span
          v-tooltip.top="comment.created_at"
          class="text-xs text-neutral-400"
        >
          {{ lastCommentDate }}
        </span>
      </div>
    </div>
    <button
      v-if="!alwaysExpanded"
      class="p-0.5 group rounded transition-colors flex-1 flex items-center justify-end cursor-pointer"
      tabindex="-1"
      @click.stop="$emit('toggle-collapse')"
    >
      <ChevronDown
        v-if="!isCollapsed"
        class="w-4 h-4 group-hover:text-neutral-800 text-neutral-400"
      />
      <ChevronRight
        v-else
        class="w-4 h-4 group-hover:text-neutral-800 text-neutral-400"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AppComment, DiffNavigateEvent } from '@/types'
import { computed } from 'vue'
import { getTimeAgo } from '@/lib/utils'
import GithubAvatar from '@/components/custom/GithubAvatar.vue'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { useComments } from './useComments'

// TODO: this should be responsive
const LIMIT_FILE_PATH_LENGTH = 50

const { threadMetaMap } = useComments()!

const emit = defineEmits<{
  (e: 'select-file', event: DiffNavigateEvent): void
  (e: 'toggle-collapse'): void
}>()

const props = defineProps<{
  comment: AppComment
  isCollapsed: boolean
  alwaysExpanded: boolean
}>()

const filePath = computed(() => {
  if (!props.comment.code_anchor) return null

  const path = props.comment.code_anchor.file_path
  if (path.length <= LIMIT_FILE_PATH_LENGTH) return path

  // slide from the end
  return '...' + path.slice(-LIMIT_FILE_PATH_LENGTH)
})

const fileName = computed(() => {
  if (!props.comment.code_anchor) return null

  return props.comment.code_anchor.file_path.split('/').pop()
})

function formatDate (date: Date | string): string {
  return getTimeAgo(date)
}

const lastCommentDate = computed(() => {
  const comment = props.comment

  if (comment.status === 'pending') {
    return ''
  }

  if (!comment.thread_id) return ''

  // Note that is not .thread_id because we want to display
  // this lastCommentDate for root comment
  const rootCommentId = comment.id
  if (!rootCommentId) return formatDate(comment.created_at)

  const threadMeta = threadMetaMap.value.threadMeta.get(rootCommentId)
  if (!threadMeta) return formatDate(comment.created_at)

  return formatDate(threadMeta.lastCommentAt)
})

const participants = computed(() => {
  const threadId = props.comment.thread_id

  const threadMeta = threadId ? threadMetaMap.value.threadMeta.get(threadId) : undefined

  if (!threadMeta || threadMeta.participantUsernames.length === 0) {
    return [props.comment.user_display_name]
  }

  return threadMeta.participantUsernames
})

const participantsText = computed(() => {
  const usernames = participants.value
  if (usernames.length === 0) return ''
  if (usernames.length === 1) return usernames[0]
  if (usernames.length === 2) return `${usernames[0]} and ${usernames[1]}`
  return `${usernames[0]} and ${usernames.length - 1} others`
})

function clickCommentHeader (comment: AppComment) {
  let fileId = comment.code_anchor?.file_path

  if (comment.code_anchor?.end_side === 'LEFT') {
    fileId = `${fileId}::`
  } else {
    fileId = `::${fileId}`
  }

  const lineNumber = comment.code_anchor?.line_end ?? comment.code_anchor?.line_start ?? 0

  emit('select-file', {
    fileId,
    line: { lineNumber, side: comment.code_anchor?.end_side ?? 'RIGHT' },
    options: {
      flashing: true,
      expanded: true
    }
  })
}


</script>
