import { createInjectionState } from '@vueuse/core'
import { shallowRef } from 'vue'
import apiClient from '@/modules/apiClient'
import type { LlmProviders, LlmCredential } from './types'

const [useProvideLlms, useLlms] = createInjectionState(() => {
  const providers = shallowRef<LlmProviders | null>(null)
  const credential = shallowRef<LlmCredential | null>(null)
  const isLoadingProviders = shallowRef(false)
  const isSubmitting = shallowRef(false)
  const isDeleting = shallowRef(false)

  async function fetchProviders () {
    isLoadingProviders.value = true
    try {
      const response = await apiClient.get('/llms/providers')
      providers.value = response.data
    } finally {
      isLoadingProviders.value = false
    }
  }

  async function fetchCredential () {
    try {
      const response = await apiClient.get('/llms/credentials')
      credential.value = response.data
    } catch {
      credential.value = null
    }
  }

  async function saveCredential (providerName: string, modelCode: string, apiKey: string) {
    isSubmitting.value = true
    try {
      const response = await apiClient.post('/llms/credentials', {
        provider_name: providerName,
        model_code: modelCode,
        api_key: apiKey,
      })
      credential.value = response.data
      return response.data
    } finally {
      isSubmitting.value = false
    }
  }

  async function deleteCredential () {
    isDeleting.value = true
    try {
      await apiClient.delete('/llms/credentials')
      credential.value = null
    } finally {
      isDeleting.value = false
    }
  }

  return {
    providers,
    credential,
    isLoadingProviders,
    isSubmitting,
    isDeleting,
    fetchProviders,
    fetchCredential,
    saveCredential,
    deleteCredential,
  }
})

export { useProvideLlms, useLlms }