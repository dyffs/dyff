import { createInjectionState } from '@vueuse/core'
import { ref, type Ref } from 'vue'
import type { FileDiff } from '@/types'

export interface DiffContextMenuData {
  filePath: string
  fileDiff: FileDiff
  oldLineStart?: number
  oldLineEnd?: number
  newLineStart?: number
  newLineEnd?: number
}

export interface ContextMenuState {
  isOpen: Ref<boolean>
  anchorElement: Ref<HTMLElement | null>
  contextData: Ref<DiffContextMenuData | null>
  open: (element: HTMLElement, data: DiffContextMenuData) => void
  close: () => void
  isCommentOpen: Ref<boolean>
  commentAnchorElement: Ref<HTMLElement | null>
  commentContextData: Ref<DiffContextMenuData | null>
  openComment: (element: HTMLElement, data: DiffContextMenuData) => void
  closeComment: () => void
}

const [useProvideContextMenu, useContextMenu] = createInjectionState((): ContextMenuState => {
  const isOpen = ref(false)
  const anchorElement = ref<HTMLElement | null>(null)
  const contextData = ref<DiffContextMenuData | null>(null)

  function open (element: HTMLElement, data: DiffContextMenuData) {
    anchorElement.value = element
    contextData.value = data
    isOpen.value = true
  }

  function close () {
    isOpen.value = false
    anchorElement.value = null
    contextData.value = null
  }

  // Comment popup state (separate from context menu)
  const isCommentOpen = ref(false)
  const commentAnchorElement = ref<HTMLElement | null>(null)
  const commentContextData = ref<DiffContextMenuData | null>(null)

  function openComment (element: HTMLElement, data: DiffContextMenuData) {
    commentAnchorElement.value = element
    commentContextData.value = data
    isCommentOpen.value = true
  }

  function closeComment () {
    isCommentOpen.value = false
    commentAnchorElement.value = null
    commentContextData.value = null
  }

  return {
    isOpen,
    anchorElement,
    contextData,
    open,
    close,
    isCommentOpen,
    commentAnchorElement,
    commentContextData,
    openComment,
    closeComment,
  }
})

export { useContextMenu, useProvideContextMenu }