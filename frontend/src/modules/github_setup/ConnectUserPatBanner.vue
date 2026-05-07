<template>
  <div
    v-if="show"
    class="mx-4 mt-2 flex items-center justify-between gap-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
  >
    <div class="flex items-center gap-2">
      <Info class="h-4 w-4 shrink-0" />
      <span>
        You're using the team's read-only GitHub access. Connect your own Personal
        Access Token to comment and approve as yourself.
      </span>
    </div>
    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        @click="goToSetup"
      >
        Connect
      </Button>
      <Button
        variant="ghost"
        size="sm"
        @click="dismiss"
      >
        <X class="h-4 w-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { Info, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useGithubSetup } from './useGithubSetup'

const DISMISS_KEY = 'dyff_connect_user_pat_banner_dismissed'

const router = useRouter()
const { showConnectUserBanner } = useGithubSetup()!

const dismissed = shallowRef(sessionStorage.getItem(DISMISS_KEY) === '1')

const show = computed(() => showConnectUserBanner.value && !dismissed.value)

function dismiss () {
  dismissed.value = true
  sessionStorage.setItem(DISMISS_KEY, '1')
}

function goToSetup () {
  void router.push('/github-setup')
}
</script>
