import { createInjectionState } from '@vueuse/core'
import { computed, type Ref } from 'vue'
import type { AppComment, SerializedPullRequest } from '@/types'
import { isBot } from '@/lib/utils'
import { useCommentConfig } from './useCommentConfig'
import { createEventHook } from '@vueuse/core'

export interface CommentThread {
  id: string
  comments: AppComment[]
}

export interface ThreadMeta {
  participantUsernames: string[]
  lastCommentAt: string
  totalComments: number
}

export interface PrMeta {
  participantUsernames: string[]
  totalThreads: number
}

function getUsername (item: AppComment): string {
  return item.user_display_name ?? ''
}

function getCreatedAt (item: AppComment): string {
  return item.created_at instanceof Date
    ? item.created_at.toISOString()
    : String(item.created_at)
}

const [useProvideComments, useComments] = createInjectionState((
  pullRequest: Ref<SerializedPullRequest | null>,
) => {
  const commentConfig = useCommentConfig()
  const onCommentNavigateTo = createEventHook<string>()

  const filteredComments = computed(() => {
    if (!pullRequest.value) return []

    const comments = pullRequest.value.comments ?? []
    if (commentConfig?.showBotComments.value) {
      return comments
    }
    return comments.filter(comment => !isBot(comment.user_display_name))
  })

  const threads = computed(() => {
    const threadMap = new Map<string, AppComment[]>()

    // Build threads from GitHub comments
    for (const comment of filteredComments.value) {
      const commentId = comment.id
      const threadId = comment.thread_id

      if (!threadId && !threadMap.has(commentId)) {
        threadMap.set(commentId, [])
      }

      if (threadId && !threadMap.has(threadId)) {
        threadMap.set(threadId, [])
      }

      if (threadId) {
        const thread = threadMap.get(threadId)
        if (thread) thread.push(comment)
      } else {
        const thread = threadMap.get(commentId)
        if (thread) thread.push(comment)
      }
    }

    // Sort comments within each thread and build result
    const result: CommentThread[] = []
    for (const [id, comments] of threadMap) {
      comments.sort((a, b) =>
        new Date(getCreatedAt(a)).getTime() - new Date(getCreatedAt(b)).getTime()
      )
      result.push({ id, comments })
    }

    result.sort((a, b) => {
      const aFirst = a.comments[0]
      const bFirst = b.comments[0]
      if (!aFirst || !bFirst) return 0
      return new Date(getCreatedAt(aFirst)).getTime() - new Date(getCreatedAt(bFirst)).getTime()
    })

    return result
  })

  const threadIds = computed(() => threads.value.map(t => t.id))

  const threadMetaMap = computed(() => {
    const threadMeta = new Map<string, ThreadMeta>()
    const allParticipants = new Set<string>()
    let nonBotThreadCount = 0

    for (const thread of threads.value) {
      const participants = new Set<string>()
      let lastCommentAt = thread.comments[0] ? getCreatedAt(thread.comments[0]) : ''

      for (const item of thread.comments) {
        const username = getUsername(item)
        if (username && !isBot(username)) {
          participants.add(username)
          allParticipants.add(username)
        }

        const createdAt = getCreatedAt(item)
        if (new Date(createdAt) > new Date(lastCommentAt)) {
          lastCommentAt = createdAt
        }
      }

      if (participants.size > 0) {
        nonBotThreadCount++
      }

      threadMeta.set(thread.id, {
        participantUsernames: Array.from(participants),
        lastCommentAt,
        totalComments: thread.comments.length
      })
    }

    return {
      threadMeta,
      prMeta: {
        participantUsernames: Array.from(allParticipants),
        totalThreads: nonBotThreadCount
      }
    }
  })

  const pullRequestId = computed(() => pullRequest.value?.id ?? null)

  function addReplyComment (comment: AppComment) {
    if (!pullRequest.value) return
    if (!pullRequest.value.comments) {
      pullRequest.value.comments = []
    }
    pullRequest.value.comments.push(comment)
  }

  return {
    pullRequest,
    pullRequestId,
    addReplyComment,
    filteredComments,
    threads,
    threadIds,
    threadMetaMap,
    onCommentNavigateTo
  }
})

export { useProvideComments, useComments }
