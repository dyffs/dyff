<template>
  <FloatingWindow
    :is-open="isOpen"
    :priority="1"
    :initial-x-percent="initialXPercent"
    :initial-y-percent="initialYPercent"
    :initial-width-percent="initialWidthPercent"
    :initial-height-percent="initialHeightPercent"
    :min-width="420"
    :min-height="320"
    @update:is-open="isOpen = $event"
    @update:position-percent="onPositionChange"
    @update:size-percent="onSizeChange"
  >
    <MiniIDE
      ref="miniIDERef"
      :repo-meta="repoMeta"
      :files="files"
    />
  </FloatingWindow>
</template>

<script setup lang="ts">
import { ref, watch, type Ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

import FloatingWindow from '@/components/custom/FloatingWindow.vue'
import MiniIDE from './MiniIDE.vue'

import { useCodeSearch } from './useCodeSearch'
import type { FileDiff } from '@/types'

interface Props {
  repoMeta: { owner: string; repo: string; commitSha: string } | null
  files?: FileDiff[]
}

defineProps<Props>()

const { isOpen } = useCodeSearch()!

// Persisted layout (percent of viewport). Stored as percentages so the window
// reopens at a sensible spot/size even if the user moves to a different screen.
const persistedX = useLocalStorage<number | string | null>('floating-search-x-percent', null)
const persistedY = useLocalStorage<number | string | null>('floating-search-y-percent', null)
const persistedWidth = useLocalStorage<number | string | null>('floating-search-width-percent', null)
const persistedHeight = useLocalStorage<number | string | null>('floating-search-height-percent', null)

// Compute default centered layout: height min(60%, 800px), width min(50%, 1440px).
function computeDefaultWidthPercent (): number {
  const screenW = window.innerWidth
  const width = Math.min(screenW * 0.5, 1440)
  return width / screenW * 100
}

function computeDefaultHeightPercent (): number {
  const screenH = window.innerHeight
  const height = Math.min(screenH * 0.6, 800)
  return height / screenH * 100
}

const defaultWidthPercent = computeDefaultWidthPercent()
const defaultHeightPercent = computeDefaultHeightPercent()

const initialWidthPercent: Ref<number> = ref(persistedWidth.value ? Number(persistedWidth.value) : defaultWidthPercent)
const initialHeightPercent: Ref<number> = ref(persistedHeight.value ? Number(persistedHeight.value) : defaultHeightPercent)
const initialXPercent: Ref<number> = ref(persistedX.value ? Number(persistedX.value) : (100 - initialWidthPercent.value) / 2)
const initialYPercent: Ref<number> = ref(persistedY.value ? Number(persistedY.value) : (100 - initialHeightPercent.value) / 2)

// Recompute defaults each time the window opens so a move between screens
// still yields a sensible centered layout when nothing is persisted.
watch(isOpen, (open) => {
  if (!open) return
  const widthPct = persistedWidth.value ? Number(persistedWidth.value) : computeDefaultWidthPercent()
  const heightPct = persistedHeight.value ? Number(persistedHeight.value) : computeDefaultHeightPercent()
  initialWidthPercent.value = widthPct
  initialHeightPercent.value = heightPct
  initialXPercent.value = persistedX.value ? Number(persistedX.value) : (100 - widthPct) / 2
  initialYPercent.value = persistedY.value ? Number(persistedY.value) : (100 - heightPct) / 2
})

function onPositionChange (pos: { x: number; y: number }) {
  persistedX.value = pos.x
  persistedY.value = pos.y
}

function onSizeChange (sz: { width: number; height: number }) {
  persistedWidth.value = sz.width
  persistedHeight.value = sz.height
}

const miniIDERef = ref<InstanceType<typeof MiniIDE> | null>(null)

function focus () {
  miniIDERef.value?.focus()
}

defineExpose({ focus })
</script>
