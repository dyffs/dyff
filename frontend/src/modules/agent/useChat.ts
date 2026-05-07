import { type Ref, computed, ref, shallowRef, watch } from 'vue'
import { createInjectionState } from '@vueuse/core'
import type { SerializedPullRequest } from '@/types'
import type { SerializedChatSession, SessionMessage, SessionProgress } from './types'
import type { Job, JobStatus } from '@/modules/job/types'
import { createChatSession, listChatSessions, getChatSession, sendMessage } from './chatApi'
import { createJobPoller } from '@/modules/job/jobPoller'
import { toast } from 'vue-sonner'

const [useProvideChat, useChat] = createInjectionState((pr: Ref<SerializedPullRequest | null>) => {
  const sessions = ref<SerializedChatSession[]>([])
  const activeSession = ref<SerializedChatSession | null>(null)
  const isLoading = shallowRef(false)
  const isSending = shallowRef(false)
  const currentProgress = shallowRef<SessionProgress | null>(null)

  const jobPoller = createJobPoller()

  const messages = computed<SessionMessage[]>(() => {
    if (!activeSession.value) return []
    return activeSession.value.session_data.messages
  })

  async function initChat () {
    const prVal = pr.value
    if (!prVal) return

    isLoading.value = true
    try {
      const list = await listChatSessions(prVal.id)
      sessions.value = list
      if (list.length > 0) {
        activeSession.value = list[0]! // already sorted DESC by created_at
      } else {
        const session = await createChatSession(prVal.id)
        sessions.value = [session]
        activeSession.value = session
      }
    } catch (err) {
      console.error('[useChat] initChat failed:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function send (text: string): Promise<void> {
    if (!activeSession.value || isSending.value) return

    const session = activeSession.value
    // Optimistic append; onJobResult's refresh replaces it with the persisted record.
    // Reassign the array (rather than push) so the `session_data.messages` property
    // write triggers reactivity even if the API payload is frozen/non-reactive.
    const optimistic: SessionMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      raw: text,
      metadata: {},
    }
    session.session_data.messages = [...session.session_data.messages, optimistic]

    isSending.value = true
    currentProgress.value = null
    try {
      const { jobId, status } = await sendMessage(session.id, text)

      jobPoller.pollAgentResult(jobId, status as JobStatus, {
        onProgress: (update) => {
          const sp = update.sessions.find((s) => s.sessionId === session.id)
          if (sp) currentProgress.value = sp
        },
        onResult: (job) => void onJobResult(job),
      })
    } catch (err) {
      console.error('[useChat] send failed:', err)
      isSending.value = false
      session.session_data.messages = session.session_data.messages.filter(m => m.id !== optimistic.id)
    }
  }

  async function onJobResult (job: Job): Promise<void> {
    isSending.value = false
    currentProgress.value = null

    if (job.status !== 'completed') {
      toast.error(job.error ?? 'An error occurred while generating the response')
      return
    }

    if (activeSession.value) {
      try {
        const updated = await getChatSession(activeSession.value.id)
        activeSession.value = updated
      } catch (err) {
        console.error('[useChat] refresh session failed:', err)
      }
    }
  }

  function selectSession (session: SerializedChatSession) {
    activeSession.value = session
  }

  async function createNewSession (): Promise<void> {
    const prVal = pr.value
    if (!prVal || isSending.value) return

    try {
      const session = await createChatSession(prVal.id)
      sessions.value = [session, ...sessions.value]
      activeSession.value = session
    } catch (err) {
      console.error('[useChat] createNewSession failed:', err)
    }
  }

  watch(
    () => pr.value?.id,
    (newId) => {
      sessions.value = []
      activeSession.value = null
      currentProgress.value = null
      if (newId) void initChat()
    },
    { immediate: true },
  )

  return {
    sessions,
    activeSession,
    messages,
    isLoading,
    isSending,
    currentProgress,
    initChat,
    send,
    selectSession,
    createNewSession,
  }
})

export { useProvideChat, useChat }
