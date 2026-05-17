<template>
  <div class="p-6">
    <div class="mx-auto max-w-2xl space-y-6">
      <h1 class="text-2xl font-semibold tracking-tight">
        My Account
      </h1>

      <!-- User Info Card -->
      <Card class="rounded-lg">
        <CardContent class="space-y-4">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label class="text-muted-foreground">Display Name</Label>
              <p class="font-medium">
                {{ user?.display_name || '-' }}
              </p>
            </div>
            <div>
              <Label class="text-muted-foreground">Email</Label>
              <p class="font-medium">
                {{ user?.email || '-' }}
              </p>
            </div>
            <div>
              <Label class="text-muted-foreground">Role</Label>
              <p class="font-medium">
                {{ user?.role || '-' }}
              </p>
            </div>
            <div>
              <Label class="text-muted-foreground">GitHub Username</Label>
              <p class="font-medium">
                {{ user?.github_username || 'Not connected' }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- GitHub Connection Card -->
      <Card
        class="gap-2 rounded-lg"
      >
        <CardHeader>
          <CardTitle class="flex items-center gap-2 mb-2">
            <img
              :src="`/assets/github-logo-${colorMode === 'dark' ? 'white' : 'black'}.svg`"
              class="h-4 w-4"
            >
            <span>GitHub Connection</span>
          </CardTitle>
          <CardDescription
            v-if="status?.user_pat_used_for_team"
            class="text-primary"
          >
            Your Personal Access Token
            <ul class="list-disc list-inside">
              <li>
                is <strong>shared with the team</strong> for read access
                (PRs, comments, codes...)
              </li>
              <li>
                is used for your own write actions
                (commenting, approvals).
              </li>
            </ul>
          </CardDescription>
          <CardDescription
            v-else
            class="text-primary"
          >
            Your Personal Access Token is used for your own write actions
            (commenting, approvals).
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4 text-sm">
          <div class="flex items-center gap-2 mt-2">
            <div
              class="h-2 w-2 rounded-full"
              :class="isConnected ? 'bg-success' : 'bg-destructive'"
            />
            <span class="text-sm">
              {{ isConnected ? 'Connected via PAT' : 'Not connected' }}
            </span>
          </div>

          <AlertDialog
            v-if="disconnectScope"
            v-model:open="confirmOpen"
          >
            <AlertDialogTrigger as-child>
              <Button
                variant="destructive"
                size="sm"
                :disabled="isDisconnecting"
              >
                Disconnect GitHub
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {{
                    disconnectScope === 'team'
                      ? 'Disconnect GitHub for the entire team?'
                      : 'Disconnect GitHub?'
                  }}
                </AlertDialogTitle>
                <AlertDialogDescription class="text-primary">
                  <template v-if="disconnectScope === 'team'">
                    Your token is <span class="text-primary">shared with the team</span> for read access. Disconnecting
                    will <span class="text-destructive">remove GitHub access for everyone</span> on the team — they will
                    no longer be able to view PRs, comments, or repositories until
                    a new team token is connected.
                  </template>
                  <template v-else>
                    This will remove your Personal Access Token. You'll lose write
                    access (commenting, approvals) until you reconnect.
                  </template>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel :disabled="isDisconnecting">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  :disabled="isDisconnecting"
                  @click="handleDisconnect"
                >
                  {{ isDisconnecting ? 'Disconnecting…' : 'Disconnect' }}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <div class="flex justify-end">
        <Button
          variant="outline"
          :disabled="isLoading"
          @click="handleLogout"
        >
          <LogOut class="h-4 w-4" />
          {{ isLoading ? 'Signing out...' : 'Sign Out' }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { LogOut } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useAccount } from './useAccount'
import { useGithubSetup } from '../github_setup/useGithubSetup'
import { useColorMode } from '@vueuse/core'

const { user, logout } = useAccount()!
const { status, disconnect } = useGithubSetup()!

const colorMode = useColorMode()

const isLoading = shallowRef(false)
const isDisconnecting = shallowRef(false)
const confirmOpen = shallowRef(false)

const isAdmin = computed(() => user.value?.role === 'admin')
const isConnected = computed(() => {
  const s = status.value
  if (!s) return false
  if (s.user_connected) return true
  return isAdmin.value && s.team_connected
})

// 'team'  → admin disconnecting the team-shared PAT (affects whole team)
// 'user'  → disconnecting the user's own PAT (write-only)
// null    → nothing to disconnect
const disconnectScope = computed<'team' | 'user' | null>(() => {
  const s = status.value
  if (!s) return null
  if (isAdmin.value && s.team_connected) return 'team'
  if (s.user_connected) return 'user'
  return null
})

async function handleDisconnect () {
  const scope = disconnectScope.value
  if (!scope) return
  isDisconnecting.value = true
  try {
    await disconnect(scope === 'team')
    toast.success(scope === 'team' ? 'Team disconnected' : 'Disconnected')
    confirmOpen.value = false
  } catch {
    // toast handled by apiClient interceptor
  } finally {
    isDisconnecting.value = false
  }
}

async function handleLogout () {
  isLoading.value = true
  try {
    await logout()
  } finally {
    isLoading.value = false
  }
}
</script>
