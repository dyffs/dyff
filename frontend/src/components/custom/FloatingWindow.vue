<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed flex flex-col bg-background border border-border rounded-sm shadow-xl overflow-hidden"
      :style="{
        top: `${position.y}px`,
        left: `${position.x}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex,
      }"
      @mousedown="bringToFront"
    >
      <!-- Drag handle -->
      <div
        class="h-5 shrink-0 flex items-center justify-center gap-1 cursor-move bg-muted/10 border-b border-border select-none"
        @mousedown="onDragStart"
      >
        <GripHorizontal class="size-3 text-muted-foreground pointer-events-none" />
        <button
          class="absolute right-1 top-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
          @mousedown.stop
          @click="close"
        >
          <X class="size-3" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 min-h-0 overflow-auto">
        <slot />
      </div>

      <!-- Right resize handle -->
      <div
        class="absolute top-0 right-0 bottom-0 w-1 cursor-e-resize hover:bg-accent"
        @mousedown.stop="onResizeStart('right', $event)"
      />
      <!-- Bottom resize handle -->
      <div
        class="absolute bottom-0 left-0 right-0 h-1 cursor-s-resize hover:bg-accent"
        @mousedown.stop="onResizeStart('bottom', $event)"
      />
      <!-- Bottom-right corner resize handle -->
      <div
        class="absolute bottom-0 right-0 size-2.5 cursor-se-resize"
        @mousedown.stop="onResizeStart('corner', $event)"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { GripHorizontal, X } from 'lucide-vue-next'
import { onKeyStroke } from '@vueuse/core'

interface Props {
  isOpen: boolean
  priority?: number
  initialXPercent?: number
  initialYPercent?: number
  initialWidthPercent?: number
  initialHeightPercent?: number
  minWidth?: number
  minHeight?: number
  closeOnEscape?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  priority: 0,
  initialXPercent: 10,
  initialYPercent: 10,
  initialWidthPercent: 40,
  initialHeightPercent: 50,
  minWidth: 220,
  minHeight: 160,
  closeOnEscape: true,
})

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
  'update:positionPercent': [value: { x: number; y: number }]
  'update:sizePercent': [value: { width: number; height: number }]
}>()

const position = ref({
  x: props.initialXPercent / 100 * window.innerWidth,
  y: props.initialYPercent / 100 * window.innerHeight,
})
const size = ref({
  width: props.initialWidthPercent / 100 * window.innerWidth,
  height: props.initialHeightPercent / 100 * window.innerHeight,
})

function emitPositionPercent () {
  emit('update:positionPercent', {
    x: position.value.x / window.innerWidth * 100,
    y: position.value.y / window.innerHeight * 100,
  })
}

function emitSizePercent () {
  emit('update:sizePercent', {
    width: size.value.width / window.innerWidth * 100,
    height: size.value.height / window.innerHeight * 100,
  })
}

// --- Z-index / priority management ------------------------------------------
// Module-level registry so multiple FloatingWindow instances share counters.
// Higher `priority` always stacks above lower `priority`. Within the same
// priority tier, clicking a window bumps it to the top of that tier.
const zIndexCounters: Map<number, number> = ((): Map<number, number> => {
  const g = globalThis as unknown as { __floatingWindowZCounters?: Map<number, number> }
  if (!g.__floatingWindowZCounters) {
    g.__floatingWindowZCounters = new Map()
  }
  return g.__floatingWindowZCounters
})()

const Z_BASE = 5000
const Z_STRIDE = 10000

function nextZIndex (priority: number): number {
  const current = zIndexCounters.get(priority) ?? 0
  const next = current + 1
  zIndexCounters.set(priority, next)
  return Z_BASE + priority * Z_STRIDE + next
}

const zIndex = ref(nextZIndex(props.priority))

function bringToFront () {
  zIndex.value = nextZIndex(props.priority)
}

// --- Dragging ---------------------------------------------------------------
function onDragStart (e: MouseEvent) {
  // Ignore drags that start on the close button.
  if ((e.target as HTMLElement).closest('button')) return
  e.preventDefault()
  bringToFront()

  const startX = e.clientX
  const startY = e.clientY
  const startPosX = position.value.x
  const startPosY = position.value.y

  function onMove (ev: MouseEvent) {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    const nextX = startPosX + dx
    const nextY = startPosY + dy
    // Keep the window on-screen (leave at least the drag bar visible).
    const maxX = window.innerWidth - 40
    const maxY = window.innerHeight - 20
    position.value.x = Math.min(Math.max(0, nextX), maxX)
    position.value.y = Math.min(Math.max(0, nextY), maxY)
  }

  function onUp () {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    emitPositionPercent()
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// --- Resizing ---------------------------------------------------------------
type ResizeEdge = 'right' | 'bottom' | 'corner'

function onResizeStart (edge: ResizeEdge, e: MouseEvent) {
  e.preventDefault()
  bringToFront()

  const startX = e.clientX
  const startY = e.clientY
  const startW = size.value.width
  const startH = size.value.height

  function onMove (ev: MouseEvent) {
    if (edge === 'right' || edge === 'corner') {
      const maxW = window.innerWidth - position.value.x
      size.value.width = Math.min(
        Math.max(props.minWidth, startW + (ev.clientX - startX)),
        maxW,
      )
    }
    if (edge === 'bottom' || edge === 'corner') {
      const maxH = window.innerHeight - position.value.y
      size.value.height = Math.min(
        Math.max(props.minHeight, startH + (ev.clientY - startY)),
        maxH,
      )
    }
  }

  function onUp () {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    emitSizePercent()
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// --- Close ------------------------------------------------------------------
function close () {
  emit('update:isOpen', false)
}

// --- Keep within viewport on resize -----------------------------------------
function clampToViewport () {
  const maxX = window.innerWidth - 40
  const maxY = window.innerHeight - 20
  if (position.value.x > maxX) position.value.x = Math.max(0, maxX)
  if (position.value.y > maxY) position.value.y = Math.max(0, maxY)
}

onMounted(() => {
  window.addEventListener('resize', clampToViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', clampToViewport)
})

onKeyStroke('Escape', () => {
  if (props.closeOnEscape) {
    close()
  }
})
</script>
