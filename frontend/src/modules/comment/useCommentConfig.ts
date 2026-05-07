import { createInjectionState } from '@vueuse/core'
import { reactive, ref, watch, type Ref, toValue } from 'vue'

const COLLAPSE_STORAGE_KEY = 'dyff_comment_collapse_state'
const BOT_COMMENTS_STORAGE_KEY = 'dyff_show_bot_comments'

const [useProvideCommentConfig, useCommentConfig] = createInjectionState((prIdRef: Ref<string | null>) => {
  const collapseState = reactive<Record<string, boolean>>({})
  const showBotComments = ref(false)

  // Load state when prId becomes available
  watch(prIdRef, (prId) => {
    if (prId) {
      Object.assign(collapseState, loadCollapseState(prId))
      showBotComments.value = loadBotCommentsState(prId)
    }
  }, { immediate: true })

  watch(collapseState, () => {
    const prId = toValue(prIdRef)
    if (prId) saveCollapseState(prId, collapseState)
  }, { deep: true })
  watch(showBotComments, () => {
    const prId = toValue(prIdRef)
    if (prId) saveBotCommentsState(prId, showBotComments.value)
  })

  function isCollapsed (threadId: string): boolean {
    return collapseState[threadId] ?? false
  }

  function toggleCollapsed (threadId: string): void {
    collapseState[threadId] = !isCollapsed(threadId)
  }

  function expand (threadId: string): void {
    collapseState[threadId] = false
  }

  function collapseAll (threadIds: string[]): void {
    for (const id of threadIds) {
      collapseState[id] = true
    }
  }

  function expandAll (threadIds: string[]): void {
    for (const id of threadIds) {
      collapseState[id] = false
    }
  }

  return {
    collapseState,
    showBotComments,
    isCollapsed,
    toggleCollapsed,
    expand,
    collapseAll,
    expandAll
  }
})

function getCollapseStorageKey (prId: string): string {
  return `${COLLAPSE_STORAGE_KEY}_${prId}`
}

function getBotCommentsStorageKey (prId: string): string {
  return `${BOT_COMMENTS_STORAGE_KEY}_${prId}`
}

function loadCollapseState (prId: string): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(getCollapseStorageKey(prId))
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return {}
}

function saveCollapseState (prId: string, state: Record<string, boolean>): void {
  try {
    localStorage.setItem(getCollapseStorageKey(prId), JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

function loadBotCommentsState (prId: string): boolean {
  try {
    const stored = localStorage.getItem(getBotCommentsStorageKey(prId))
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return false
}

function saveBotCommentsState (prId: string, value: boolean): void {
  try {
    localStorage.setItem(getBotCommentsStorageKey(prId), JSON.stringify(value))
  } catch {
    // Ignore storage errors
  }
}

export { useProvideCommentConfig, useCommentConfig }
