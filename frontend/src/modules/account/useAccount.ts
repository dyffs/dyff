import { createInjectionState } from '@vueuse/core'
import { shallowRef, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { AccountState } from './types'

import apiClient from '@/modules/apiClient'

const TOKEN_KEY = 'dyff_app_auth'

const [useProvideAccount, useAccount] = createInjectionState(() => {
  const router = useRouter()
  const account = shallowRef<AccountState | null>(null)
  const isLoading = shallowRef(false)
  const error = shallowRef<string | null>(null)

  const isAuthenticated = computed(() => !!account.value?.user)
  const user = computed(() => account.value?.user ?? null)
  const team = computed(() => account.value?.team ?? null)

  function getToken (): string | null {
    return localStorage.getItem(TOKEN_KEY)
  }

  function setToken (token: string): void {
    localStorage.setItem(TOKEN_KEY, token)
  }

  function clearToken (): void {
    localStorage.removeItem(TOKEN_KEY)
  }

  async function fetchAccount (): Promise<AccountState | null> {
    const token = getToken()
    if (!token) {
      account.value = null
      return null
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await apiClient.get('/users/my-account')
      account.value = {
        user: response.data.user,
        team: response.data.team,
        github_connected: response.data.github_connected,
        github_token_expires_at: response.data.github_token_expires_at,
      }

      return account.value
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch account'
      account.value = null
    } finally {
      isLoading.value = false
    }

    return null
  }

  function handleAuthCallback (token: string): void {
    setToken(token)
  }

  async function logout (): Promise<void> {
    try {
      await apiClient.post('/users/logout')
    } catch {
      // Ignore logout errors
    } finally {
      clearToken()
      account.value = null
      void router.push('/login')
    }
  }

  function redirectToLogin (): void {
    account.value = null
    void router.push('/login')
  }

  function loginWithGithub (): void {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3003/api'
    window.location.href = `${apiUrl}/auth/github`
  }

  async function initializeAuth (): Promise<boolean> {
    const requiresAuth = router.currentRoute.value.meta.requiresAuth ?? true

    if (!requiresAuth) {
      return false
    }

    const token = getToken()
    if (!token) {
      return false
    }

    try {
      await fetchAccount()
      if (!account.value) {
        void router.push('/login')
        return false
      }
      return true
    } catch {
      void router.push('/login')
      return false
    }
  }

  return {
    account,
    user,
    team,
    isAuthenticated,
    isLoading,
    error,
    getToken,
    setToken,
    clearToken,
    fetchAccount,
    handleAuthCallback,
    logout,
    redirectToLogin,
    loginWithGithub,
    initializeAuth,
  }
})

export { useProvideAccount, useAccount }
