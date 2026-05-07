<template>
  <div class="p-6 w-xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold mb-1">
        Connect repositories
      </h1>
      <p class="text-sm text-muted-foreground">
        Connect GitHub repos so your team can access them through this app.
      </p>
    </div>

    <!-- Connected Section -->
    <section class="mb-6">
      <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
        Connected · {{ trackedRepos.length }}
      </h2>

      <div
        v-if="isLoadingTracked || isTracking"
        class="text-sm text-muted-foreground flex items-center gap-1"
      >
        <Spinner class="size-4" /> Loading connected repositories...
      </div>

      <div
        v-else-if="trackedRepos.length === 0"
        class="text-sm text-muted-foreground"
      >
        No connected repositories yet. Pick one from the list below.
      </div>

      <div
        v-else
        class="space-y-1.5"
      >
        <router-link
          v-for="repo in trackedRepos"
          :key="repo.id"
          :to="`/repositories/${repo.github_owner}/${repo.github_repo}/pulls`"
          class="flex items-center gap-3 px-3.5 py-2.5 border rounded-md hover:bg-accent/50 transition-colors"
        >
          <GithubAvatar
            :username="repo.github_owner"
            class-name="h-7 w-7"
          />
          <div class="flex-1 min-w-0">
            <span class="text-sm font-medium hover:text-chart-2">
              {{ repo.full_name }}
            </span>
            <div class="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span>{{ repo.owner_type === 'user' ? 'Personal' : 'Organization' }}</span>
            </div>
          </div>

          <Confirm
            title="Disconnect repository"
            confirm-text="Disconnect"
            @confirm="handleUntrackRepo(repo.id)"
          >
            <template #trigger>
              <Button
                variant="ghost"
                size="xs"
                class="h-7 text-muted-2 hover:text-destructive"
                @click.stop.prevent
              >
                Disconnect
              </Button>
            </template>
            <template #description>
              Are you sure you want to disconnect <strong>{{ repo.full_name }}</strong>?
            </template>
          </Confirm>
        </router-link>
      </div>
    </section>

    <!-- Available Section -->
    <section>
      <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
        Available
      </h2>

      <div
        v-if="isLoadingAvailable"
        class="text-sm text-muted-foreground flex items-center gap-1"
      >
        <Spinner class="size-4" />
        Loading repositories...
      </div>

      <div
        v-else-if="availableRepos.length === 0"
        class="text-sm text-muted-foreground"
      >
        No repositories found. Make sure you have added a GitHub Personal Access Token.
      </div>

      <template v-else>
        <Input
          v-model="searchQuery"
          placeholder="Search repositories..."
          class="mb-3"
        />

        <div
          v-if="availableGroups.length === 0"
          class="text-sm text-muted-foreground"
        >
          No repositories match your search.
        </div>

        <div
          v-for="group in availableGroups"
          :key="group.key"
          class="mb-3"
        >
          <Collapsible
            :open="isGroupOpen(group)"
            @update:open="setGroupOpen(group, $event)"
          >
            <CollapsibleTrigger
              class="flex items-center gap-2 w-full text-left text-sm font-medium py-1.5 hover:text-foreground/80"
            >
              <ChevronRight
                class="size-3 transition-transform shrink-0"
                :class="{ 'rotate-90': isGroupOpen(group) }"
              />
              <span>
                {{ group.isPersonal ? 'Your personal account' : `${group.owner} (organization)` }}
                · {{ group.repos.length }} {{ group.repos.length === 1 ? 'repo' : 'repos' }}
              </span>
              <AlertTriangle
                v-if="group.isPersonal"
                class="size-3.5 text-yellow-600"
              />
            </CollapsibleTrigger>

            <CollapsibleContent class="mt-1">
              <div
                v-if="group.isPersonal"
                class="flex items-start gap-2 px-3 py-2 mb-1.5 text-xs rounded-md border border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900/40 dark:bg-yellow-950/30 dark:text-yellow-200"
              >
                <AlertTriangle class="size-3.5 shrink-0 mt-0.5" />
                <span>
                  These are repos in your personal GitHub account
                </span>
              </div>

              <div class="space-y-1.5">
                <div
                  v-for="repo in group.repos"
                  :key="repo.id"
                  class="flex items-center gap-3 px-3.5 py-2.5 border rounded-md hover:bg-accent/50 transition-colors"
                >
                  <GithubAvatar
                    :username="repo.github_owner"
                    class-name="h-7 w-7"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium">
                      {{ repo.full_name }}
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {{ repo.owner_type === 'user' ? 'Personal' : 'Organization' }}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    class="h-7 cursor-pointer"
                    :disabled="isTracking"
                    @click="handleConnectClick(repo)"
                  >
                    Connect
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </template>
    </section>

    <!-- Connect Confirmation Dialog -->
    <Dialog v-model:open="connectModalOpen">
      <DialogContent class="p-0 sm:max-w-[460px]">
        <div
          v-if="isPersonalConnect"
          class="flex items-center gap-1.5 px-6 py-4 bg-yellow-50 text-yellow-800 text-[11px] font-medium uppercase tracking-wider dark:bg-yellow-950/40 dark:text-yellow-200"
        >
          <AlertTriangle class="size-3.5" />
          Personal repository
        </div>

        <div :class="isPersonalConnect ? 'pt-2 pb-6 px-6' : 'p-6'">
          <DialogHeader class="mb-3">
            <DialogTitle>
              {{ isPersonalConnect
                ? 'Share your personal repo with the team?'
                : 'Connecting a repo shares it with your team' }}
            </DialogTitle>
          </DialogHeader>

          <DialogDescription
            as="div"
            class="space-y-3 text-sm text-primary"
          >
            <template v-if="isPersonalConnect">
              <p>
                The repo <code class="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-primary">{{ connectingRepo?.full_name }}</code>
                is in your personal GitHub account
              </p>
              <p>
                Connecting it will let everyone on your team read its contents through this app.
              </p>
            </template>
            <template v-else>
              <p>
                You're about to connect
                <code class="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{{ connectingRepo?.full_name }}</code>
                to this app.
              </p>
              <p>
                When you connect a repo, everyone on your team can <strong class="font-bold">READ</strong> it through this app: pull requests,
                branches, and code.

                <br>
                <br>

                The <strong class="font-bold">WRITE access</strong> e.g. posting a comment will <strong class="font-bold">NOT</strong> be shared.
              </p>
            </template>
          </DialogDescription>

          <label
            v-if="!isPersonalConnect"
            class="flex items-center gap-2 mt-5 text-sm text-primary cursor-pointer"
          >
            <Checkbox v-model="dontShowAgain" />
            Don't show this again
          </label>

          <DialogFooter class="mt-6">
            <Button
              variant="outline"
              @click="connectModalOpen = false"
            >
              Cancel
            </Button>
            <Button
              :disabled="isTracking"
              class="cursor-pointer"
              @click="handleConfirmConnect"
            >
              Connect
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRepo } from './useRepo'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronRight, AlertTriangle } from 'lucide-vue-next'
import GithubAvatar from '@/components/custom/GithubAvatar.vue'
import Confirm from '@/components/custom/Confirm.vue'
import type { SerializedRepository } from '@/types'

const SKIP_ORG_CONFIRM_KEY = 'dyff_skip_org_connect_confirm'

const repoStore = useRepo()
if (!repoStore) {
  throw new Error('useRepo must be called within a component that has useProvideRepo')
}

const {
  availableRepos,
  trackedRepos,
  isLoadingAvailable,
  isLoadingTracked,
  isTracking,
  fetchAvailableRepos,
  fetchTrackedRepos,
  trackRepositories,
  untrackRepository,
} = repoStore

const searchQuery = ref('')

interface RepoGroup {
  key: string
  owner: string
  isPersonal: boolean
  repos: SerializedRepository[]
}

const availableGroups = computed<RepoGroup[]>(() => {
  const trackedFullNames = new Set(trackedRepos.value.map(r => r.full_name))
  let repos = availableRepos.value.filter(r => !trackedFullNames.has(r.full_name))

  const query = searchQuery.value.trim().toLowerCase()
  if (query) {
    repos = repos.filter(repo => {
      const fullName = repo.full_name.toLowerCase()
      return fullName.includes(query)
    })
  }

  const groupsMap = new Map<string, RepoGroup>()
  for (const repo of repos) {
    const isPersonal = repo.owner_type === 'user'
    const key = isPersonal ? '__personal__' : repo.github_owner
    let group = groupsMap.get(key)
    if (!group) {
      group = {
        key,
        owner: repo.github_owner,
        isPersonal,
        repos: [],
      }
      groupsMap.set(key, group)
    }
    group.repos.push(repo)
  }

  return [...groupsMap.values()].sort((a, b) => {
    if (a.isPersonal !== b.isPersonal) return a.isPersonal ? 1 : -1
    return a.owner.localeCompare(b.owner)
  })
})

const openGroups = ref<Record<string, boolean>>({})

function isGroupOpen (group: RepoGroup): boolean {
  const value = openGroups.value[group.key]
  if (value === undefined) return false
  return value
}

function setGroupOpen (group: RepoGroup, value: boolean) {
  openGroups.value = { ...openGroups.value, [group.key]: value }
}

const connectModalOpen = ref(false)
const connectingRepo = ref<SerializedRepository | null>(null)
const dontShowAgain = ref(false)

const isPersonalConnect = computed(() => connectingRepo.value?.owner_type === 'user')

function handleConnectClick (repo: SerializedRepository) {
  if (repo.owner_type !== 'user' && localStorage.getItem(SKIP_ORG_CONFIRM_KEY) === 'true') {
    void doConnect(repo)
    return
  }
  connectingRepo.value = repo
  dontShowAgain.value = false
  connectModalOpen.value = true
}

async function handleConfirmConnect () {
  const repo = connectingRepo.value
  if (!repo) return

  if (!isPersonalConnect.value && dontShowAgain.value) {
    localStorage.setItem(SKIP_ORG_CONFIRM_KEY, 'true')
  }

  connectModalOpen.value = false
  await doConnect(repo)
  connectingRepo.value = null
  dontShowAgain.value = false
}

async function doConnect (repo: SerializedRepository) {
  try {
    await trackRepositories([{ owner: repo.github_owner, repo: repo.github_repo }])
  } catch (error) {
    console.error('Error tracking repo:', error)
  }
}

async function handleUntrackRepo (repoId: string) {
  try {
    await untrackRepository(repoId)
  } catch (error) {
    console.error('Error untracking repo:', error)
  }
}

onMounted(async () => {
  await fetchTrackedRepos()
  await fetchAvailableRepos()
})
</script>
