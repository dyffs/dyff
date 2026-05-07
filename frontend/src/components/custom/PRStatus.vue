<template>
  <div :class="`flex items-center pr-status gap-1 ${status}`">
    <GitPullRequest class="size-3" />
    <span class="text-xs capitalize">{{ status }}</span>
  </div>
</template>

<script setup lang="ts">
import { GitPullRequest } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  status: 'open' | 'closed' | 'merged'
  merged: boolean
}>()

const status = computed(() => {
  if (props.merged) {
    return 'merged'
  }
  return props.status
})
</script>