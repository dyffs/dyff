<template>
  <div
    :id="`file-${file.id}`"
    ref="rootEl"
    class="border rounded-md bg-white flex flex-col mb-4"
  >
    <!-- File Header -->
    <div
      class="px-2 py-1 flex items-center sticky bg-white top-0 z-10 group overflow-hidden border-b"
      :class="{ 'rounded-md': !file.isExpanded, 'rounded-t-md': file.isExpanded }"
    >
      <div class="flex items-center justify-start gap-1 overflow-hidden flex-1">
        <span
          class="hover:bg-neutral-200 rounded-sm p-0.5 cursor-pointer"
          @click="$emit('toggle-file-expanded', file.id)"
        >
          <component
            :is="file.isExpanded ? ChevronDown : ChevronRight"
            class="size-4 text-gray-400"
          />
        </span>
        <span class="text-xs wrap-anywhere flex-1 mr-2 font-medium flex items-center gap-1">
          <span class="flex items-center">
            <span class="text-neutral-700">
              {{ file.status === 'renamed' ? `${file.oldPath} → ${file.newPath}` : file.newPath }}
            </span>
          </span>
          <div
            class="text-xs group-hover:flex hidden text-muted-foreground hover:text-neutral-800 cursor-pointer items-center gap-1 ml-2"
            @click="codeSearchCtrl.openFile(file.newPath)"
          >
            Open File <ExternalLink class="size-3" />
          </div>
        </span>
      </div>

      <div class="flex items-center gap-3">
        <div class="text-xs">
          <span class="text-green-600 dark:text-green-400">+{{ file.additions }}</span>
          <span class="mx-1 text-muted-foreground">/</span>
          <span class="text-red-600 dark:text-red-400">-{{ file.deletions }}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          class="text-muted-foreground h-7 text-xs"
          @click.stop="$emit('toggle-file-reviewed', file.id)"
        >
          <Check
            v-if="isFileReviewed(file.newPath)"
            class="size-3"
          />
          <Square
            v-else
            class="size-3"
          />
          Reviewed
        </Button>
      </div>
    </div>

    <!-- Body: real content when near viewport, spacer otherwise -->
    <template v-if="file.isExpanded">
      <div
        v-if="shouldRender"
        ref="bodyEl"
        class="overflow-x-auto pb-1"
      >
        <InlineMode
          v-if="diffMode === 'inline'"
          :file="file"
          :get-threads-for-line="getThreadsForLine"
          @select-file="$emit('select-file', $event)"
        />
        <SplitMode
          v-else
          :file="file"
          :get-threads-for-line="getThreadsForLine"
          @select-file="$emit('select-file', $event)"
        />
      </div>
      <div
        v-else
        :style="{ height: spacerHeight + 'px' }"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, ChevronDown, ChevronRight, ExternalLink, Square } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'

import InlineMode from './InlineMode.vue'
import SplitMode from './SplitMode.vue'

import type { FileDiff, AppComment, DiffNavigateEvent } from '@/types'
import type { CommentThread } from '@/modules/comment/useComments'
import { useCodeSearch } from '@/modules/search/useCodeSearch'
import { useVirtualDiffScroller } from './useVirtualDiffScroller'

interface LineThread {
  thread: CommentThread
  threadId: string
  rootComment: AppComment
  replyCount: number
}

interface Props {
  file: FileDiff
  diffMode: 'inline' | 'split'
  isFileReviewed: (path: string) => boolean
  getThreadsForLine: (filePath: string, side: 'LEFT' | 'RIGHT', lineNumber: number | undefined) => LineThread[]
}

const props = defineProps<Props>()

defineEmits<{
  'toggle-file-expanded': [fileId: string]
  'toggle-file-reviewed': [fileId: string]
  'select-file': [event: DiffNavigateEvent]
}>()

const codeSearchCtrl = useCodeSearch()!
const scroller = useVirtualDiffScroller()!

const rootEl = ref<HTMLElement | null>(null)
const bodyEl = ref<HTMLElement | null>(null)

const isNearViewport = ref(false)
const forceRender = ref(false)
const shouldRender = computed(() => isNearViewport.value || forceRender.value)

const cachedBodyHeight = ref(0)
// Rough estimate for unmeasured bodies: ~18px/line + small chrome.
const estimatedBodyHeight = computed(() => {
  const lines = props.file.hunks.reduce((sum, h) => sum + h.lines.length, 0)
  return lines * 18 + 8
})
const spacerHeight = computed(() =>
  cachedBodyHeight.value > 0 ? cachedBodyHeight.value : estimatedBodyHeight.value
)

let io: IntersectionObserver | null = null
let ro: ResizeObserver | null = null

onMounted(() => {
  if (!rootEl.value) return

  scroller.registerFile(props.file.id, {
    el: rootEl.value,
    ensureRendered: () => {
      forceRender.value = true
    },
  })

  io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      isNearViewport.value = entry.isIntersecting
    }
  }, {
    root: scroller.containerRef.value,
    rootMargin: '2000px 0px',
  })
  io.observe(rootEl.value)
})

onBeforeUnmount(() => {
  scroller.unregisterFile(props.file.id)
  io?.disconnect()
  ro?.disconnect()
})

// Observe body size whenever it is mounted; tear down observer when unmounted.
watch(bodyEl, (el, _old, onCleanup) => {
  if (!el) return
  ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const h = entry.contentRect.height
      if (h > 0) cachedBodyHeight.value = h
    }
  })
  ro.observe(el)
  onCleanup(() => {
    ro?.disconnect()
    ro = null
  })
})
</script>
