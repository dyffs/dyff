<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="menuRef"
      class="w-[160px] shadow-md rounded-md p-1 bg-white border border-border z-50"
      :style="menuStyle"
    >
      <ul class="space-y-0.5">
        <li
          class="px-2 py-1 hover:bg-neutral-100 rounded cursor-pointer text-xs flex items-center gap-1.5"
          @click="onSearchThis"
        >
          <Search class="size-3.5" />
          <span>Search text</span>
        </li>
      </ul>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, type CSSProperties } from 'vue'
import { computePosition, offset, flip, shift } from '@floating-ui/dom'
import { onClickOutside } from '@vueuse/core'
import { Search } from 'lucide-vue-next'
import { useDiffTextSelection } from './useDiffTextSelection'
import { useCodeSearch } from '@/modules/search/useCodeSearch'

const { isOpen, selectedText, virtualAnchor, hide } = useDiffTextSelection()!
const { triggerCodeSearch } = useCodeSearch()!

const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<CSSProperties>({
  position: 'absolute',
  top: '0',
  left: '0',
})

watch([isOpen, virtualAnchor], async () => {
  if (isOpen.value && virtualAnchor.value && menuRef.value) {
    const { x, y } = await computePosition(virtualAnchor.value as any, menuRef.value, {
      placement: 'top-start',
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

onClickOutside(menuRef, () => {
  if (isOpen.value) {
    hide()
  }
})

function onSearchThis () {
  triggerCodeSearch(selectedText.value)
  hide()
}
</script>
