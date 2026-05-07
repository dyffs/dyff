import { createInjectionState } from '@vueuse/core'
import { shallowRef, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import apiClient from '@/modules/apiClient'
import { useAccount } from '@/modules/account/useAccount'

type DeploymentMode = 'saas' | 'self_hosted'

interface GithubSetupStatus {
  mode: DeploymentMode
  user_connected: boolean
  team_connected: boolean
  user_pat_used_for_team?: boolean
}

const [useProvideGithubSetup, useGithubSetup] = createInjectionState(() => {
  const router = useRouter()
  const { user } = useAccount()!

  const status = shallowRef<GithubSetupStatus | null>(null)
  const isLoading = shallowRef(false)
  const hasLoaded = shallowRef(false)
  const error = shallowRef<string | null>(null)

  const teamConnected = computed(() => status.value?.team_connected ?? null)
  const userConnected = computed(() => status.value?.user_connected ?? null)
  const showConnectUserBanner = computed(() => {
    if (!status.value) return false
    return status.value.team_connected && !status.value.user_connected
  })

  async function fetchStatus (): Promise<GithubSetupStatus | null> {
    isLoading.value = true
    error.value = null
    try {
      const response = await apiClient.get('/github-setup/status')
      status.value = response.data
      hasLoaded.value = true
      return status.value
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch GitHub setup status'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function submitPat (personalAccessToken: string, forTeam: boolean) {
    const response = await apiClient.post('/github-setup/personal_access_token', {
      personal_access_token: personalAccessToken,
      for_team: forTeam,
    })
    await fetchStatus()
    return response.data
  }

  async function disconnect (forTeam: boolean) {
    const response = await apiClient.post('/github-setup/disconnect', { for_team: forTeam })
    await fetchStatus()
    return response.data
  }

  // Watch the setup status + current route, and redirect to /github-setup when
  // the current route requires setup and the team is not connected. Routes opt
  // out via `meta.requiresGithubSetup: false`.
  function watchSetupStatus () {
    const route = useRoute()

    watch(
      [status, () => route.meta.requiresGithubSetup],
      ([s, requiresSetup]) => {
        if (!s) return
        if (requiresSetup === false) return
        if (!s.team_connected) {
          void router.replace('/github-setup')
        }
      },
      { immediate: true }
    )
  }

  return {
    status,
    isLoading,
    hasLoaded,
    error,
    teamConnected,
    userConnected,
    showConnectUserBanner,
    user,
    fetchStatus,
    submitPat,
    disconnect,
    watchSetupStatus,
  }
})

export { useProvideGithubSetup, useGithubSetup }
export type { GithubSetupStatus, DeploymentMode }
