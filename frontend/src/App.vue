<template>
  <SidebarProvider v-if="!route.meta.hideLayout">
    <AppSidebar />
    <SidebarInset>
      <header class="flex mt-2 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
        <div class="flex items-center gap-2 px-4">
          <SidebarTrigger class="-ml-1 text-neutral-400" />
          <div id="header-teleport" />
        </div>
      </header>
      <ConnectUserPatBanner />
      <div class="flex flex-1 flex-col gap-4 overflow-y-auto">
        <RouterView />
      </div>
    </SidebarInset>
  </SidebarProvider>
  <RouterView v-else />
  <Toaster
    position="top-center"
    rich-colors
  />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppSidebar from '@/modules/AppSidebar.vue'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import 'vue-sonner/style.css'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { Toaster } from '@/components/ui/sonner'
import { onMounted } from 'vue'

import { useProvideRepo } from '@/modules/repo/useRepo'
import { useProvidePullRequest } from '@/modules/pull_request/usePullRequest'
import { useProvideAccount } from '@/modules/account/useAccount'
import { useProvideGithubSetup } from '@/modules/github_setup/useGithubSetup'
import { useProvideLlms } from '@/modules/llms/useLlms'
import ConnectUserPatBanner from '@/modules/github_setup/ConnectUserPatBanner.vue'

const route = useRoute()

const { initializeAuth, isAuthenticated } = useProvideAccount()
useProvideRepo()
useProvidePullRequest()
const { fetchStatus, watchSetupStatus } = useProvideGithubSetup()
useProvideLlms()

watchSetupStatus()

onMounted(async () => {
  await initializeAuth()
  if (isAuthenticated.value) {
    void fetchStatus()
  }
})
</script>
