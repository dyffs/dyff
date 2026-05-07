<template>
  <div class="p-6">
    <div class="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          GitHub Setup
        </h1>
        <p class="text-sm text-muted-foreground">
          Connect FastPR to GitHub so we can fetch repositories and pull requests.
        </p>
      </div>

      <div
        v-if="!status"
        class="text-sm text-muted-foreground"
      >
        Loading…
      </div>

      <template v-else>
        <!-- Non-admin, team not connected -->
        <Card v-if="!status.team_connected && !isAdmin">
          <CardHeader>
            <CardTitle>Team not connected</CardTitle>
            <CardDescription>
              Your team hasn't connected GitHub yet. Please ask an admin to set it up.
            </CardDescription>
          </CardHeader>
        </Card>

        <!-- Admin, team not connected: PAT form -->
        <Card v-else-if="!status.team_connected && isAdmin">
          <CardHeader>
            <CardTitle>Connect your team</CardTitle>
            <CardDescription>
              Paste a GitHub Personal Access Token. By default it will also be used
              as the team token (read-only for teammates). Your own actions still use
              this token with full access.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label for="pat">Personal Access Token</Label>
              <Input
                id="pat"
                v-model="pat"
                type="password"
                placeholder="ghp_…"
                autocomplete="off"
              />
            </div>
            <Button
              :disabled="!pat || submitting"
              @click="handleSubmit"
            >
              {{ submitting ? 'Connecting…' : 'Connect GitHub' }}
            </Button>
          </CardContent>
        </Card>

        <!-- Team connected: show state + user PAT form if user not connected -->
        <template v-else>
          <Card>
            <CardHeader>
              <CardTitle>Team connection</CardTitle>
              <CardDescription>
                Your team is connected to GitHub.
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-2">
              <div class="flex items-center gap-2 text-sm">
                <div class="h-2 w-2 rounded-full bg-green-500" />
                <span>Connected</span>
              </div>
              <Button
                v-if="isAdmin"
                variant="outline"
                size="sm"
                :disabled="submitting"
                @click="handleDisconnect(true)"
              >
                Disconnect team
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your GitHub connection</CardTitle>
              <CardDescription>
                <template v-if="status.user_connected">
                  Your personal token is connected.
                </template>
                <template v-else>
                  Connect your own Personal Access Token to get write access for your
                  actions (comments, approvals). Without it, you have read-only access
                  through the team token.
                </template>
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div
                v-if="status.user_connected"
                class="flex items-center gap-2 text-sm"
              >
                <div class="h-2 w-2 rounded-full bg-green-500" />
                <span>Connected</span>
              </div>
              <template v-else>
                <div class="space-y-2">
                  <Label for="user-pat">Personal Access Token</Label>
                  <Input
                    id="user-pat"
                    v-model="pat"
                    type="password"
                    placeholder="ghp_…"
                    autocomplete="off"
                  />
                </div>
                <Button
                  :disabled="!pat || submitting"
                  @click="handleSubmit"
                >
                  {{ submitting ? 'Connecting…' : 'Connect' }}
                </Button>
              </template>
              <Button
                v-if="status.user_connected"
                variant="outline"
                size="sm"
                :disabled="submitting"
                @click="handleDisconnect(false)"
              >
                Disconnect
              </Button>
            </CardContent>
          </Card>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGithubSetup } from './useGithubSetup'
import { useAccount } from '@/modules/account/useAccount'

const router = useRouter()
const { status, submitPat, disconnect } = useGithubSetup()!
const { user } = useAccount()!

const pat = shallowRef('')
const forTeam = shallowRef(true)
const submitting = shallowRef(false)

const isAdmin = computed(() => user.value?.role === 'admin')

async function handleSubmit () {
  if (!pat.value) return
  submitting.value = true
  try {
    const teamFlag = status.value?.team_connected ? false : isAdmin.value && forTeam.value
    await submitPat(pat.value, teamFlag)
    pat.value = ''
    toast.success('GitHub connected')
    if (status.value?.team_connected) {
      void router.push('/repositories')
    }
  } catch {
    // toast handled by apiClient interceptor
  } finally {
    submitting.value = false
  }
}

async function handleDisconnect (teamFlag: boolean) {
  submitting.value = true
  try {
    await disconnect(teamFlag)
    toast.success(teamFlag ? 'Team disconnected' : 'Disconnected')
  } catch {
    // toast handled by apiClient interceptor
  } finally {
    submitting.value = false
  }
}
</script>
