<template>
  <button
    ref="triggerRef"
    class="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent transition-colors cursor-pointer"
    :class="{ 'bg-accent': isOpen }"
    @click="isOpen = !isOpen"
  >
    <FolderTree class="size-3.5" />
    <span class="text-xs">Files</span>
    <span class="text-xs text-muted-foreground">({{ filesLength }})</span>
  </button>

  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="popupRef"
      class="z-50 w-[380px] bg-background border border-border rounded-lg shadow-lg flex flex-col overflow-hidden"
      :style="{ ...popupStyle, maxHeight: `${heightPercent}vh` }"
    >
      <div class="flex items-center justify-between px-3 py-2 border-b">
        <span class="text-xs font-medium">File Tree</span>
        <button
          class="text-muted-foreground hover:text-foreground cursor-pointer"
          @click="isOpen = false"
        >
          <X class="size-3.5" />
        </button>
      </div>
      <div ref="scrollRef" class="flex-1 overflow-y-auto p-2" @scroll="onScroll">
        <div
          v-if="isFetchingDiff"
          class="flex items-center justify-center py-8"
        >
          <Spinner class="size-5" />
        </div>
        <div v-else>
          <FileTreeNode
            v-for="node in fileTree"
            :key="node.path"
            :node="node"
            :depth="0"
            :selected-file-id="selectedFileId"
            @select-file="$emit('select-file', $event)"
            @toggle-folder="$emit('toggle-folder', $event)"
          />
        </div>
      </div>
      <div
        class="h-2 cursor-s-resize hover:bg-accent bg-gray-100 transition-colors shrink-0 flex items-center justify-center"
        @mousedown="onResizeStart"
      >
        <GripHorizontal class="size-2.5 text-neutral-400" />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, type CSSProperties } from 'vue'
import { useLocalStorage, useEventListener, useDebounceFn, onClickOutside } from '@vueuse/core'
import { computePosition, offset, flip, shift } from '@floating-ui/dom'
import { FolderTree, X } from 'lucide-vue-next'
import { Spinner } from '@/components/ui/spinner'
import FileTreeNode from './FileTreeNode.vue'
import type { FileTreeNode as FileTreeNodeType, DiffNavigateEvent } from '@/types'
import { GripHorizontal } from 'lucide-vue-next'

defineProps<{
  fileTree: FileTreeNodeType[]
  isFetchingDiff: boolean
  selectedFileId: string | null
  filesLength: number
}>()

defineEmits<{
  'select-file': [event: DiffNavigateEvent]
  'toggle-folder': [path: string]
}>()

const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)
const popupStyle = ref<CSSProperties>({
  position: 'absolute',
  top: '0',
  left: '0',
})

const heightPercent = useLocalStorage('file-tree-popup-height', 50)
const scrollTop = useLocalStorage('file-tree-popup-scroll', 0)
const scrollRef = ref<HTMLElement | null>(null)

const onScroll = useDebounceFn(() => {
  if (scrollRef.value) {
    scrollTop.value = scrollRef.value.scrollTop
  }
}, 150)

async function updatePosition () {
  if (!triggerRef.value || !popupRef.value) return
  const { x, y } = await computePosition(triggerRef.value, popupRef.value, {
    placement: 'bottom-end',
    middleware: [
      offset(8),
      flip(),
      shift({ padding: 8 }),
    ],
  })
  popupStyle.value = {
    position: 'absolute',
    top: `${y}px`,
    left: `${x}px`,
  }
}

watch(isOpen, async (open) => {
  if (!open) return
  await nextTick()
  updatePosition()
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollTop.value
  }
})

onClickOutside(popupRef, () => {
  isOpen.value = false
}, { ignore: [triggerRef] })

useEventListener('resize', () => {
  if (isOpen.value) updatePosition()
})

function onResizeStart (e: MouseEvent) {
  e.preventDefault()
  const startY = e.clientY
  const startPercent = heightPercent.value

  function onMouseMove (e: MouseEvent) {
    const deltaPercent = (e.clientY - startY) / window.innerHeight * 100
    heightPercent.value = Math.min(90, Math.max(20, startPercent + deltaPercent))
  }

  function onMouseUp () {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

</script>
