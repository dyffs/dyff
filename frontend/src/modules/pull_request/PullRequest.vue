<template>
  <div class="flex flex-col w-6xl xl:w-7xl mx-auto flex-1 overflow-y-auto mb-4">
    <!-- Header -->
    <div class="w-full mb-6 flex items-center gap-2">
      <GithubAvatar :username="(route.params.owner as string)" />
      <div class="flex flex-col">
        <h1 class="text-xl font-semibold text-foreground">
          Pull Requests
        </h1>
        <p class="text-sm text-muted-foreground -mt-1">
          {{ route.params.owner }}/{{ route.params.repo }}
        </p>
      </div>
    </div>

    <!-- Main Table -->
    <div class="w-full flex-1 flex flex-col overflow-y-auto">
      <div class="rounded-md border border-border overflow-y-auto flex flex-col flex-1">
        <!-- Toolbar: search + filter chips -->
        <div class="sticky top-0 z-20 bg-background px-4 py-2.5 border-b border-border flex items-center gap-3">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              v-model="search"
              type="text"
              placeholder="Search by title, author, or #..."
              class="w-full bg-background border border-border rounded-md pl-9 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring h-8"
            >
          </div>
          <div class="flex items-center gap-1">
            <button
              v-for="f in filterOptions"
              :key="f"
              :class="[
                'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                isFilterActive(f)
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border hover:text-foreground'
              ]"
              @click="toggleFilter(f)"
            >
              {{ filterLabel(f) }}
            </button>
          </div>
        </div>

        <div
          v-show="isLoading"
          class="w-full px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Spinner /> Fetching PRs for {{ route.params.owner }}/{{ route.params.repo }}...
        </div>

        <table
          v-show="!isLoading"
          class="w-full"
        >
          <thead>
            <tr class="text-xs text-muted-foreground uppercase tracking-wider">
              <th class="sticky top-[53px] z-10 bg-background border-b border-border text-left py-2 pl-4 pr-2 font-medium w-6" />
              <th class="sticky top-[53px] z-10 bg-background border-b border-border text-left py-2 px-4 font-medium">
                Title
              </th>
              <th class="sticky top-[53px] z-10 bg-background border-b border-border text-left py-2 px-4 font-medium">
                Author
              </th>
              <th class="sticky top-[53px] z-10 bg-background border-b border-border text-left py-2 px-4 font-medium">
                Reviewers
              </th>
              <th class="sticky top-[53px] z-10 bg-background border-b border-border text-right py-2 px-4 font-medium">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            <PRRow
              v-for="pr in visiblePRs"
              :key="pr.pr_number"
              :pr="pr"
              :needs-review="needsReview(pr)"
            />
          </tbody>
        </table>

        <div
          v-show="!isLoading && visiblePRs.length === 0"
          class="py-12 text-center text-sm text-muted-foreground"
        >
          No PRs match your filters
        </div>
      </div>

      <div class="mt-4 text-center">
        <p class="text-xs text-zinc-600">
          Only last 100 PRs sorted by update time are shown
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Search } from 'lucide-vue-next'
import PRRow from './PRRow.vue'
import { usePullRequest } from './usePullRequest'
import { transformPRData } from './utils'
import type { DashboardPR } from '@/types'
import GithubAvatar from '@/components/custom/GithubAvatar.vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import { useAccount } from '@/modules/account/useAccount'

type FilterKey = 'open' | 'no-draft' | 'merged'

const route = useRoute()
const { pullRequests, isLoading, init } = usePullRequest()!

const prs = ref<DashboardPR[]>([])
const search = ref('')
const activeFilters = ref<Set<FilterKey>>(new Set(['open', 'no-draft']))
const filterOptions: FilterKey[] = ['open', 'no-draft', 'merged']

const owner = computed(() => route.params.owner as string)
const repo = computed(() => route.params.repo as string)

function preparePRs () {
  prs.value = pullRequests.value
    .map(pr => transformPRData(pr, owner.value, repo.value))
    .sort((a, b) => b.updatedAtRaw.getTime() - a.updatedAtRaw.getTime())
}

watch([pullRequests], preparePRs)

watch(
  () => [route.params.owner, route.params.repo],
  ([newOwner, newRepo]) => {
    void init(newOwner as string, newRepo as string)
  },
  { immediate: true }
)

const { user } = useAccount()!

function needsReview (pr: DashboardPR): boolean {
  if (pr.reviewers.includes(user.value?.github_username || '')) return true
  if (pr.author === user.value?.github_username || '') return true
  return false
}

const needsReviewIds = computed(() => {
  const set = new Set<number>()
  for (const pr of prs.value) {
    if (needsReview(pr)) set.add(pr.pr_number)
  }
  return set
})

function isFilterActive (f: FilterKey): boolean {
  return activeFilters.value.has(f)
}

function toggleFilter (f: FilterKey) {
  const next = new Set(activeFilters.value)
  if (next.has(f)) next.delete(f)
  else next.add(f)
  activeFilters.value = next

  // If 'merged' is active, remove 'open'
  if (f === 'merged') {
    next.delete('open')
  }

  // If 'open' is active, remove 'merged'
  if (f === 'open') {
    next.delete('merged')
  }
}

function filterLabel (f: FilterKey): string {
  return f.charAt(0).toUpperCase() + f.slice(1)
}

function matchesFilters (pr: DashboardPR): boolean {
  if (activeFilters.value.size === 0) return true
  for (const f of activeFilters.value) {
    if (f === 'open' && !(pr.status === 'open')) return false
    if (f === 'no-draft' && pr.isDraft) return false
    if (f === 'merged' && pr.status !== 'merged') return false
  }
  return true
}

function matchesSearch (pr: DashboardPR): boolean {
  const q = search.value.trim().toLowerCase()
  if (!q) return true
  const stripped = q.startsWith('#') ? q.slice(1) : q
  return (
    pr.title.toLowerCase().includes(q) ||
    pr.author.toLowerCase().includes(q) ||
    pr.pr_number.toString().includes(stripped)
  )
}

const visiblePRs = computed(() => {
  const filtered = prs.value.filter(pr => matchesFilters(pr) && matchesSearch(pr))
  const reviewSet = needsReviewIds.value
  const top: DashboardPR[] = []
  const rest: DashboardPR[] = []
  for (const pr of filtered) {
    if (reviewSet.has(pr.pr_number)) top.push(pr)
    else rest.push(pr)
  }
  return [...top, ...rest]
})
</script>

<style scoped>
</style>
