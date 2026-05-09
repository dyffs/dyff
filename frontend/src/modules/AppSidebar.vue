<template>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <ShowerHead /><span>Dyff</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton @click="router.push('/repositories')">
              <HardDrive /><span>Repositories</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <TrackedReposSidebar />
        <SidebarMenu v-if="showGithubSetup">
          <SidebarMenuItem>
            <SidebarMenuButton @click="router.push('/llms')">
              <Factory /><span>LLM Providers</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu v-if="showTeam">
          <SidebarMenuItem>
            <SidebarMenuButton @click="router.push('/team')">
              <Users /><span>Team</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton @click="router.push('/account')">
              <Settings /><span>Account</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <ColorMode />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ShowerHead, HardDrive, Settings, Factory, Users } from 'lucide-vue-next'
import ColorMode from './ColorMode.vue'
import TrackedReposSidebar from './repo/TrackedReposSidebar.vue'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useAccount } from './account/useAccount'
import { isSelfHostedMode } from '@/lib/utils'

const router = useRouter()
const { user } = useAccount()!
const showTeam = computed(() => isSelfHostedMode() && user.value?.role === 'admin')
const showGithubSetup = computed(() => isSelfHostedMode() && user.value?.role === 'admin')
</script>