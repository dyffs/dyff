import { createInjectionState } from '@vueuse/core'
import { shallowRef, ref } from 'vue'
import apiClient from '@/modules/apiClient'
import type { TeamUser, InviteUserPayload, UpdateUserPayload } from './types'

const [useProvideTeam, useTeam] = createInjectionState(() => {
  const users = ref<TeamUser[] | null>(null)
  const isLoading = shallowRef(false)
  const isSubmitting = shallowRef(false)
  const isDeleting = shallowRef(false)

  async function fetchUsers () {
    isLoading.value = true
    try {
      const response = await apiClient.get('/users')
      users.value = response.data.users
    } finally {
      isLoading.value = false
    }
  }

  async function inviteUser (payload: InviteUserPayload) {
    isSubmitting.value = true
    try {
      const response = await apiClient.post('/users/invite', payload)
      const invited: TeamUser = response.data.user
      users.value = [...users.value ?? [], invited]
      return invited
    } finally {
      isSubmitting.value = false
    }
  }

  async function updateUser (id: string, payload: UpdateUserPayload) {
    isSubmitting.value = true
    try {
      const response = await apiClient.patch(`/users/${id}`, payload)
      const updated: TeamUser = response.data.user
      users.value = (users.value ?? []).map(u => u.id === id ? updated : u)
      return updated
    } finally {
      isSubmitting.value = false
    }
  }

  async function deleteUser (id: string) {
    isDeleting.value = true
    try {
      await apiClient.delete(`/users/${id}`)
      const u = users.value?.find(u => u.id === id)
      if (u) {
        u.deleted_at = new Date().toISOString()
      }
    } finally {
      isDeleting.value = false
    }
  }

  return {
    users,
    isLoading,
    isSubmitting,
    isDeleting,
    fetchUsers,
    inviteUser,
    updateUser,
    deleteUser,
  }
})

export { useProvideTeam, useTeam }
