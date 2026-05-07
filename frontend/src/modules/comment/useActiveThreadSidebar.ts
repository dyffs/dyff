import { ref } from 'vue'

// Module-level singleton — only one thread sidebar can be open at a time across all instances
const activeThreadId = ref<string | null>(null)

export function useActiveThreadSidebar () {
  function open (threadId: string) {
    activeThreadId.value = threadId
  }

  function close () {
    activeThreadId.value = null
  }

  return { activeThreadId, open, close }
}
