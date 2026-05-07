<template>
  <div class="flex items-center gap-1">
    <ReviewerAvatar
      v-for="reviewer in displayReviewers"
      :key="reviewer"
      :reviewer="reviewer"
      :current-username="currentUsername || ''"
      class="-ml-1"
    />
    <div
      v-if="hiddenCount > 0"
      v-tooltip="{ content: hiddenUsernames, html: true }"
      class="w-6 h-6 rounded-full dark:bg-zinc-800 border dark:border-zinc-700 border-border-80 flex items-center justify-center text-[11px] font-medium text-zinc-400 -ml-1 cursor-pointer"
    >
      +{{ hiddenCount }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ReviewerAvatar from './ReviewerAvatar.vue'
import { useRepo } from '@/modules/repo/useRepo'

interface Props {
  reviewers: string[]
}

const props = defineProps<Props>()

const { currentUsername } = useRepo()!

const MAX_VISIBLE = 3


const displayReviewers = computed(() => {
  const currentUserReviewer = props.reviewers.find(r => r === currentUsername.value)

  if (currentUserReviewer) {
    const otherReviewers = props.reviewers.filter(r => r !== currentUsername.value)
    return [currentUserReviewer, ...otherReviewers].slice(0, MAX_VISIBLE)
  }

  return props.reviewers.slice(0, MAX_VISIBLE)
})

const hiddenUsernames = computed(() =>
  // just return all the usernames
  `<div>
    ${props.reviewers.map(
      r => `<div>${r}</div>`
    ).join('')}
  </div>`
  
)

const hiddenCount = computed(() =>
  Math.max(0, props.reviewers.length - MAX_VISIBLE)
)
</script>
