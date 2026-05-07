<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="menuRef"
      class="w-[170px] shadow-md rounded-md p-2 bg-white border border-border z-50"
      :style="menuStyle"
    >
      <!-- A simple context menu for demo -->
      <ul class="space-y-1">
        <li
          class="px-2 py-1 hover:bg-neutral-100 rounded cursor-pointer text-sm flex items-center gap-1"
          @click="onAddBookmark"
        >
          <Bookmark class="size-4" />
          <span>Add bookmark</span>
        </li>
        <li
          class="px-2 py-1 hover:bg-neutral-100 rounded cursor-pointer text-sm flex items-center gap-1"
          @click="onAddComment"
        >
          <MessageCircle class="size-4" />
          <span>Add comment</span>
        </li>
      </ul>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useContextMenu } from './useContextMenu'
import { ref, watch, type CSSProperties } from 'vue'
import { computePosition, offset, flip, shift } from '@floating-ui/dom'
import { onClickOutside } from '@vueuse/core'
import { Bookmark, MessageCircle } from 'lucide-vue-next'

import { useCodeBookmark } from '@/modules/bookmark/useCodeBookmark'

const contextMenu = useContextMenu()!
const { isOpen, anchorElement, contextData, close } = contextMenu

const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<CSSProperties>({
  position: 'absolute',
  top: '0',
  left: '0',
})

const { addBookmark, setVisibility } = useCodeBookmark()!

// Update position when menu opens or anchor changes
watch([isOpen, anchorElement], async () => {
  if (isOpen.value && anchorElement.value && menuRef.value) {
    const { x, y } = await computePosition(anchorElement.value, menuRef.value, {
      placement: 'right-start',
      middleware: [
        offset(8),
        flip(),
        shift({ padding: 8 })
      ]
    })

    menuStyle.value = {
      position: 'absolute',
      top: `${y}px`,
      left: `${x}px`,
    }
  }
}, { flush: 'post' })

// Close menu when clicking outside
onClickOutside(menuRef, () => {
  if (isOpen.value) {
    close()
  }
}, {
  ignore: [anchorElement]
})

function onAddComment () {
  const anchor = anchorElement.value
  const data = contextData.value
  if (!anchor || !data) return

  close()
  contextMenu.openComment(anchor, data)
}

function onAddBookmark () {
  if (!contextData.value?.fileDiff) return

  const lineStart = contextData.value.oldLineStart ?? contextData.value.newLineStart
  const lineEnd = contextData.value.oldLineEnd ?? contextData.value.newLineEnd
  const side = contextData.value.oldLineStart ? 'old' : 'new'

  if (!lineStart || !lineEnd || !side) return

  void addBookmark({
    fileDiff: contextData.value.fileDiff,
    lineStart,
    lineEnd,
    side,
    description: ''
  })

  setVisibility(true)

  close()
}
</script>