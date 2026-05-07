import apiClient from '@/modules/apiClient'
import type { SerializedChatSession } from './types'
import type { SessionProgress } from '@/modules/agent/types'

async function createChatSession (pullRequestId: string) {
  const response = await apiClient.post<SerializedChatSession>('/chat_sessions', { pullRequestId })
  return response.data
}

async function listChatSessions (pullRequestId: string) {
  const response = await apiClient.get<SerializedChatSession[]>(`/chat_sessions/pull_request/${pullRequestId}`)
  return response.data
}

async function getChatSession (id: string) {
  const response = await apiClient.get<SerializedChatSession>(`/chat_sessions/${id}`)
  return response.data
}

async function deleteChatSession (id: string) {
  const response = await apiClient.delete<{ success: boolean }>(`/chat_sessions/${id}`)
  return response.data
}

async function sendMessage (sessionId: string, message: string) {
  const response = await apiClient.post<{ jobId: string; status: string; sessionId: string }>(`/chat_sessions/${sessionId}/messages`, { message })
  return response.data
}

async function getSessionProgress (sessionId: string) {
  const response = await apiClient.get<SessionProgress>(`/chat_sessions/${sessionId}/progress`)
  return response.data
}

export { createChatSession, listChatSessions, getChatSession, deleteChatSession, sendMessage, getSessionProgress }
