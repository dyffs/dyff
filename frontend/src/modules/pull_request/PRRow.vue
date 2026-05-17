<template>
  <tr
    class="
      group border-b border-border-subtle transition-colors hover:bg-background-hover
    "
    :class="[needsReview ? 'bg-amber-500/10' : '']"
  >
    <td class="py-3 pl-4 pr-1 w-6">
      <span
        v-tooltip="statusLabel"
        :class="[
          'inline-block w-2 h-2 rounded-full',
          dotClass
        ]"
      />
    </td>
    <td class="py-3 px-4">
      <div class="flex flex-col">
        <RouterLink
          :to="`/repositories/${pr.owner}/${pr.repo}/pulls/${pr.pr_number}`"
          class="text-primary text-sm font-medium hover:text-blue-700 dark:hover:text-blue-400"
        >
          <span class="text-muted-foreground mr-2">#{{ pr.pr_number }}</span>
          <span class="text-primary dark:text-white dark:font-semibold mr-2">{{ pr.title }}</span>
        </RouterLink>
        <span class="text-muted-foreground text-xs">{{ pr.branch }} → {{ pr.baseBranch }}</span>
      </div>
    </td>
    <td class="py-3 px-4">
      <div class="flex items-center gap-2">
        <div
          v-tooltip="pr.author"
          class="w-6 h-6"
        >
          <GithubAvatar
            :username="pr.author"
            class="w-6 h-6 ring-border ring-1"
          />
        </div>
        <span class="text-muted-foreground text-xs">{{ pr.author }}</span>
      </div>
    </td>
    <td class="py-3 px-4">
      <ReviewersCell :reviewers="pr.reviewers" />
    </td>
    <td class="py-3 px-4 text-right text-xs text-muted-foreground tabular-nums whitespace-nowrap">
      {{ pr.updatedAt }}
    </td>
  </tr>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ReviewersCell from './ReviewersCell.vue'
import type { DashboardPR } from '@/types'
import GithubAvatar from '@/components/custom/GithubAvatar.vue'

interface Props {
  pr: DashboardPR
  needsReview: boolean
}

const props = withDefaults(defineProps<Props>(), {
  needsReview: false,
})

const dotClass = computed(() => {
  if (props.pr.isDraft) return 'border border-zinc-400 dark:border-zinc-500 bg-transparent'
  if (props.pr.status === 'merged') return 'bg-purple-500'
  if (props.pr.status === 'closed') return 'bg-zinc-400 dark:bg-zinc-500'
  return 'bg-emerald-500'
})

const statusLabel = computed(() => {
  if (props.pr.isDraft) return 'Draft'
  if (props.pr.status === 'merged') return 'Merged'
  if (props.pr.status === 'closed') return 'Closed'
  return 'Open'
})
</script>
