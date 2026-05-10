<template>
  <div
    v-if="rootComment"
    class="px-4 py-3"
  >
    <!-- Comment header: avatar + username + time -->
    <div class="flex items-center gap-2 mb-2">
      <GithubAvatar
        :username="rootComment.user_display_name"
        class="h-5 w-5 ring-1 ring-neutral-300"
      />
      <span class="font-medium text-sm">{{ rootComment.user_display_name }}</span>
      <span
        v-tooltip.top="rootComment.created_at"
        class="text-xs text-muted-foreground"
      >
        {{ getTimeAgo(rootComment.created_at) }}
      </span>
    </div>

    <div class="ml-6">
      <!-- File path (if code anchor exists) -->
      <div
        v-if="filePath"
        v-tooltip.top="rootComment.code_anchor?.file_path"
        class="flex items-center gap-1 mb-2 text-xs text-neutral-500 group cursor-pointer w-fit"
        @click="clickCommentHeader"
      >
        <span class="group-hover:underline font-medium">{{ fileName }}</span>
      </div>
      <!-- Diff hunk -->
      <DiffHunkDisplay
        v-if="showDiffHunk && rootComment.content.diff_hunk"
        :diff-hunk="rootComment.content.diff_hunk"
        :max-lines="8"
        class="mb-3 text-xs"
      />

      <!-- Comment body -->
      <div
        v-if="rootComment.content.body"
        :class="`prose ${MARKDOWN_STYLES_CLASS}`"
        v-html="renderedHtml"
      />

      <!--
        The event from this element will be emitted to open the popup
        Be careful not to hide this element e.g v-if that will break the popup position
      -->
      <div @click="$emit('open-thread', $event)">
        <!-- N replies row -->
        <button
          v-if="replies.length > 0"
          class="mt-3 flex items-center gap-2 text-xs group hover:bg-neutral-50
        -mx-2 px-2 py-1 rounded w-full text-left cursor-pointer focus:outline-none"
        >
          <div class="flex -space-x-1">
            <UnifiedAvatar
              v-for="(name, index) in replyParticipants"
              :key="index"
              :name="name"
              class="h-4 w-4 ring-1 ring-white"
            />
          </div>
          <span class="text-blue-600 group-hover:underline font-medium">
            {{ replies.length }} {{ replies.length === 1 ? 'reply' : 'replies' }}
          </span>
          <span class="text-muted-foreground">
            {{ lastReplyTime }}
          </span>
        </button>
        <button
          v-else
          class="mt-3 flex items-center gap-1 text-xs group hover:bg-neutral-50
        -mx-2 px-2 py-1 rounded w-full text-left cursor-pointer hover:text-blue-600 focus:outline-none"
        >
          <Reply class="h-3 w-3" />
          Add a reply
        </button>
      </div>

      <!-- Agent progress indicator -->
      <AgentProgressIndicator
        v-if="agentSessionId"
        :progress="agentProgress"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommentThread } from './types'
import type { DiffNavigateEvent } from '@/types'
import { computed, toRefs, type ComputedRef, ref } from 'vue'
import { getTimeAgo } from '@/lib/utils'
import { useMarkdownRenderer } from '@/utils/markdownRendererGithub'
import GithubAvatar from '@/components/custom/GithubAvatar.vue'
import DiffHunkDisplay from './DiffHunkDisplay.vue'
import UnifiedAvatar from '@/components/custom/UnifiedAvatar.vue'
import AgentProgressIndicator from '../agent/AgentProgressIndicator.vue'
import { MARKDOWN_STYLES_CLASS } from '../common/styles'
import { useCommentSystem } from './useCommentSystem'
import { Reply } from 'lucide-vue-next'

const LIMIT_FILE_PATH_LENGTH = 50

interface Props {
  thread: CommentThread
  showDiffHunk?: boolean
  agentSessionId?: string
}

const props = withDefaults(defineProps<Props>(), {
  showDiffHunk: true,
  agentSessionId: undefined,
})

const refProps = toRefs(props)

const emit = defineEmits<{
  'open-thread': [event: MouseEvent]
  'select-file': [event: DiffNavigateEvent]
}>()

const commentSystem = useCommentSystem()

const agentProgress = computed(() => {
  if (!props.agentSessionId || !commentSystem) return null
  // touch progressMap so this stays reactive across polls
  void commentSystem.progressMap.value
  return commentSystem.getProgress(props.agentSessionId) ?? null
})

const rootComment = computed(() => refProps.thread.value.comments[0])

const filePath = computed(() => {
  const path = rootComment.value?.code_anchor?.file_path
  if (!path) return null
  return path.length <= LIMIT_FILE_PATH_LENGTH ? path : `...${path.slice(-LIMIT_FILE_PATH_LENGTH)}`
})

const fileName = computed(() => rootComment.value?.code_anchor?.file_path.split('/').pop() ?? null)

function clickCommentHeader () {
  const comment = rootComment.value
  if (!comment?.code_anchor) return

  let fileId = comment.code_anchor.file_path
  if (comment.code_anchor.side === 'LEFT') {
    fileId = `${fileId}::`
  } else {
    fileId = `::${fileId}`
  }

  const lineNumber = comment.code_anchor.line_end ?? comment.code_anchor.line_start ?? 0
  emit('select-file', {
    fileId,
    line: { lineNumber, side: comment.code_anchor.side ?? 'RIGHT' },
    options: { flashing: true, expanded: true },
  })
}
const replies = computed(() => refProps.thread.value.comments.slice(1))

const replyParticipants: ComputedRef<string[]> = computed(() => {
  const seen = new Set<string>()
  const result = ref<string[]>([])
  for (const reply of replies.value) {
    const name = reply.user_display_name
    if (name && !seen.has(name)) {
      seen.add(name)
      result.value.push(name)
    }
  }
  console.log(result)
  return result.value.slice(0, 5)
})

const lastReplyTime = computed(() => {
  const last = replies.value[replies.value.length - 1]
  if (!last) return ''
  return getTimeAgo(last.created_at)
})

const { renderedHtml } = useMarkdownRenderer(() => ({
  markdown: rootComment.value?.content.body ?? '',
  preRenderedHtml: '',
}))
</script>
