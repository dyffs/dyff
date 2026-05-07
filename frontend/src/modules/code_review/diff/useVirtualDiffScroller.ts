import { createInjectionState } from '@vueuse/core'
import { nextTick, ref } from 'vue'

export interface DiffScrollController {
  scrollToFile: (fileId: string) => void
  scrollToLine: (fileId: string, lineNumber: number, side: 'LEFT' | 'RIGHT') => Promise<void>
  findFileId: (partialId: string) => string | undefined
}

export interface FileCardHandle {
  el: HTMLElement
  ensureRendered: () => void
}

const [useProvideVirtualDiffScroller, useVirtualDiffScroller] = createInjectionState(() => {
  const containerRef = ref<HTMLElement | null>(null)
  const registry = new Map<string, FileCardHandle>()

  function registerFile (fileId: string, handle: FileCardHandle) {
    registry.set(fileId, handle)
  }

  function unregisterFile (fileId: string) {
    registry.delete(fileId)
  }

  function findFileId (partialId: string): string | undefined {
    if (registry.has(partialId)) return partialId
    for (const id of registry.keys()) {
      if (id.includes(partialId)) return id
    }
    return undefined
  }

  function scrollToFile (fileId: string) {
    const handle = registry.get(fileId)
    const container = containerRef.value
    if (!handle || !container) return
    const elemTop = handle.el.getBoundingClientRect().top
    const containerTop = container.getBoundingClientRect().top
    container.scrollTop += elemTop - containerTop - 8 // leave a small gap
  }

  async function scrollToLine (fileId: string, lineNumber: number, side: 'LEFT' | 'RIGHT') {
    const handle = registry.get(fileId)
    const container = containerRef.value
    if (!handle || !container) return

    handle.ensureRendered()
    // Two ticks: one for the body v-if to mount, one for child subtree to paint.
    await nextTick()
    await nextTick()

    const sideValue = side === 'LEFT' ? 'left' : 'right'
    const cell = handle.el.querySelector<HTMLElement>(
      `[data-line-number="${lineNumber}"][data-side="${sideValue}"]`
    )
    if (!cell) {
      scrollToFile(fileId)
      return
    }

    // Scroll so the target line is ~1/3 down the viewport
    const cellTop = cell.getBoundingClientRect().top
    const containerTop = container.getBoundingClientRect().top
    const delta = cellTop - containerTop - container.clientHeight / 3
    container.scrollTop += delta
  }

  function onScroll () {
    // No-op; kept for callers that still invoke it (e.g. to hide popups).
    // Scroll position is no longer tracked in layout.
  }

  const scrollController: DiffScrollController = {
    scrollToFile,
    scrollToLine,
    findFileId,
  }

  return {
    containerRef,
    registerFile,
    unregisterFile,
    scrollToFile,
    scrollToLine,
    findFileId,
    onScroll,
    scrollController,
  }
})

export { useProvideVirtualDiffScroller, useVirtualDiffScroller }
