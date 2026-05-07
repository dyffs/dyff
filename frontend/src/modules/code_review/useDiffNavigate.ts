import { createInjectionState } from '@vueuse/core'
import type { DiffNavigateEvent } from '@/types'
import { ref } from 'vue'
import type { DiffScrollController } from './diff/useVirtualDiffScroller'

const [useProvideDiffNavigate, useDiffNavigate] = createInjectionState((
  expandFileFn: (fileId: string) => void,
  scrollCtrl: DiffScrollController
) => {
  const selectedFileId = ref<string | null>(null)

  async function handleSelectFile (event: DiffNavigateEvent) {
    // Resolve partial file IDs
    const fileId = scrollCtrl.findFileId(event.fileId)
    if (!fileId) return

    selectedFileId.value = fileId

    if (event.options?.expanded) {
      expandFileFn(fileId)
    }

    const shouldFlash = event.options?.flashing && event.line

    if (shouldFlash && event.line) {
      // Scroll to the line position (ensures the file is rendered)
      scrollCtrl.scrollToLine(fileId, event.line.lineNumber, event.line.side)

      // Wait for Vue to render the file, then flash the line via DOM
      const delay = event.options?.expanded ? 50 : 0
      setTimeout(() => {
        if (!event.line) return
        const fileElem = document.getElementById(`file-${fileId}`)
        if (fileElem) {
          flashLine(fileElem, event.line.lineNumber, event.line.side)
        }
      }, delay)
    } else {
      scrollCtrl.scrollToFile(fileId)
    }
  }

  function flashLine (fileElem: HTMLElement, lineNumber: number, side: 'LEFT' | 'RIGHT') {
    const sideValue = side === 'LEFT' ? 'left' : 'right'
    const targetCell = fileElem.querySelector<HTMLElement>(
      `td[data-line-number="${lineNumber}"][data-side="${sideValue}"]`
    )

    if (!targetCell) return

    setTimeout(() => {
      const originalBackground = targetCell.style.backgroundColor
      const originalTransition = targetCell.style.transition

      targetCell.style.transition = 'background-color 0.3s ease-in-out'
      targetCell.style.backgroundColor = '#fbbf24' // amber-400

      setTimeout(() => {
        targetCell.style.backgroundColor = originalBackground

        setTimeout(() => {
          targetCell.style.transition = originalTransition
        }, 300)
      }, 600)
    }, 100)
  }

  return {
    selectedFileId,
    handleSelectFile
  }

})

export { useProvideDiffNavigate, useDiffNavigate }
