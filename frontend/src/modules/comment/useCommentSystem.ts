import { createInjectionState } from '@vueuse/core'
import { computed, onUnmounted, ref, shallowRef, triggerRef, type Ref } from 'vue'
import { isBot } from '@/lib/utils'
import {
  getRoots, getThread, type PostCommentParams,
  type PostReplyCommentParams,
  postReplyComment,
} from './commentApi'
import { getSessionProgress } from '@/modules/agent/chatApi'
import type { SessionProgress } from '@/modules/agent/types'
import type { CommentThread, RootCommentMeta, ThreadMeta } from './types'

const POLL_INTERVAL_MS = 5000
const PROGRESS_POLL_INTERVAL_MS = 3000

function detectNewThreadUpdates (newRoot: RootCommentMeta, prevRoot: RootCommentMeta): boolean {
  const newIds = Object.keys(newRoot.thread_map)
  const prevIds = Object.keys(prevRoot.thread_map)

  // Different comment IDs
  if (newIds.length !== prevIds.length || newIds.some(id => !(id in prevRoot.thread_map))) {
    return true
  }

  // Any comment has different updated_at
  for (const id of newIds) {
    if (newRoot.thread_map[id]?.updated_at !== prevRoot.thread_map[id]?.updated_at) {
      return true
    }
  }

  // Root or any comment has status 'ai_working'
  if (newRoot.status === 'ai_working') {
    return true
  }
  for (const id of newIds) {
    if (newRoot.thread_map[id]?.status === 'ai_working') {
      return true
    }
  }

  return false
}

const [useProvideCommentSystem, useCommentSystem] = createInjectionState(() => {
  const rootIndex = shallowRef<RootCommentMeta[]>([])
  const threadMap = shallowRef<{ [key: string]: Ref<CommentThread> }>({})
  const polling = ref(false)
  const progressMap = shallowRef<Record<string, SessionProgress>>({})

  let pollTimer: ReturnType<typeof setInterval> | null = null
  const activePullRequestId = ref<string | null>(null)
  const inflightRequests = new Map<string, Promise<CommentThread>>()
  const progressTimers = new Map<string, ReturnType<typeof setInterval>>()

  function trackSessionProgress (sessionId: string) {
    if (progressTimers.has(sessionId)) return
    void fetchSessionProgress(sessionId)
    const timer = setInterval(() => void fetchSessionProgress(sessionId), PROGRESS_POLL_INTERVAL_MS)
    progressTimers.set(sessionId, timer)
  }

  function untrackSessionProgress (sessionId: string) {
    const timer = progressTimers.get(sessionId)
    if (timer) {
      clearInterval(timer)
      progressTimers.delete(sessionId)
    }
    if (sessionId in progressMap.value) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete progressMap.value[sessionId]
      triggerRef(progressMap)
    }
  }

  async function fetchSessionProgress (sessionId: string) {
    try {
      const progress = await getSessionProgress(sessionId)
      progressMap.value[sessionId] = progress
      triggerRef(progressMap)
    } catch (error) {
      console.error('[useCommentSystem] fetch progress failed:', error)
    }
  }

  function getProgress (sessionId: string): SessionProgress | undefined {
    return progressMap.value[sessionId]
  }

  // --- Polling ---

  function startPolling (pullRequestId: string) {
    stopPolling()
    activePullRequestId.value = pullRequestId
    polling.value = true
    void pollOnce()
    pollTimer = setInterval(() => void pollOnce(), POLL_INTERVAL_MS)
  }

  function stopPolling () {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    polling.value = false
    activePullRequestId.value = null
  }

  async function pollOnce (pullRequestId?: string) {
    if (pullRequestId) {
      activePullRequestId.value = pullRequestId
    }

    if (!activePullRequestId.value) return

    try {
      const newRoots = await getRoots(activePullRequestId.value)
      diffAndUpdate(newRoots)
    } catch (error) {
      console.error('[useCommentSystem] poll failed:', error)
    }
  }

  // --- Diffing ---

  function diffAndUpdate (newRoots: RootCommentMeta[]) {
    const prevMap = new Map(rootIndex.value.map(r => [r.id, r]))
    const nextIds = new Set(newRoots.map(r => r.id))

    // Detect new or changed roots
    for (const root of newRoots) {
      const prev = prevMap.get(root.id)
      if (!prev || detectNewThreadUpdates(root, prev)) {
        void fetchThread(root.id)
      }
    }

    // Detect deleted roots — mutate in place, trigger once
    let deleted = false
    for (const id of Object.keys(threadMap.value)) {
      if (!nextIds.has(id)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete threadMap.value[id]
        deleted = true
      }
    }
    if (deleted) {
      triggerRef(threadMap)
    }

    rootIndex.value = newRoots

    for (const root of newRoots) {
      if (!root.agent_chat_session_id) continue
      if (root.agent_chat_session_status === 'running') {
        trackSessionProgress(root.agent_chat_session_id)
      } else {
        untrackSessionProgress(root.agent_chat_session_id)
      }
    }
  }

  // --- Thread fetching with dedup ---

  async function fetchThread (rootId: string): Promise<CommentThread> {
    const existing = inflightRequests.get(rootId)
    if (existing) return existing

    const promise = getThread(rootId)
      .then(thread => {
        const existingThread = threadMap.value[rootId]

        if (existingThread) {
          existingThread.value = thread
        } else {
          threadMap.value[rootId] = ref(thread)
          triggerRef(threadMap)
        }

        return thread
      })
      .finally(() => inflightRequests.delete(rootId))

    inflightRequests.set(rootId, promise)
    return promise
  }

  // Deprecated flow, to be removed
  async function postComment (params: PostCommentParams): Promise<void> {
    // const comment = await postCommentApi(params)
    // const rootId = comment.thread_id ?? comment.id
    // await fetchThread(rootId)
  }

  const threadMetaMap = computed(() => {
    const meta = new Map<string, ThreadMeta>()
    const allParticipants = new Set<string>()
    let nonBotThreadCount = 0

    for (const thread of Object.values(threadMap.value)) {
      const participants = new Set<string>()
      let lastCommentAt = thread.value.comments[0] ? toIso(thread.value.comments[0].created_at) : ''

      for (const comment of thread.value.comments) {
        const username = comment.user_display_name ?? ''
        if (username && !isBot(username)) {
          participants.add(username)
          allParticipants.add(username)
        }
        const createdAt = toIso(comment.created_at)
        if (new Date(createdAt) > new Date(lastCommentAt)) {
          lastCommentAt = createdAt
        }
      }

      if (participants.size > 0) {
        nonBotThreadCount++
      }

      meta.set(thread.value.id, {
        participantUsernames: Array.from(participants),
        lastCommentAt,
        totalComments: thread.value.comments.length
      })
    }

    return {
      threadMeta: meta,
      prMeta: {
        participantUsernames: Array.from(allParticipants),
        totalThreads: nonBotThreadCount
      }
    }
  })

  // --- Post reply comment ---

  async function replyComment (params: PostReplyCommentParams): Promise<void> {
    const comment = await postReplyComment(params)
    const rootId = comment.thread_id ?? comment.id
    await fetchThread(rootId)
  }

  onUnmounted(() => {
    stopPolling()
    for (const timer of progressTimers.values()) {
      clearInterval(timer)
    }
    progressTimers.clear()
  })


  return {
    activePullRequestId,
    rootIndex,
    threadMap,
    polling,
    startPolling,
    stopPolling,
    pollOnce,
    fetchThread,
    postComment,
    threadMetaMap,
    getProgress,
    progressMap,
    replyComment,
  }
})

// --- Helpers ---

function toIso (date: Date | string): string {
  return date instanceof Date ? date.toISOString() : date
}

export { useProvideCommentSystem, useCommentSystem }
