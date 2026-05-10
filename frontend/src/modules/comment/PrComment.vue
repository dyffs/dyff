<template>
  <div class="overflow-x-hidden pt-2">
    <div class="text-xs font-medium mb-2 text-muted-foreground ml-4">
      Comments
    </div>
    <template v-if="sortedThreadIds.length > 0">
      <div
        v-if="sortedThreadIds.length === 0"
        class="text-sm text-muted-foreground text-center"
      >
        No comments yet
      </div>

      <div
        v-for="threadId in sortedThreadIds"
        :key="threadId"
        class="oveflow-x-hidden pb-2 hover:bg-neutral-50"
      >
        <PrThreadList
          :thread-id="threadId"
          @select-file="handleSelectFile"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PrThreadList from './PrThreadList.vue'
import { useCommentSystem } from './useCommentSystem'
import type { DiffNavigateEvent } from '@/types'
import type { SerializedPullRequest } from '@/types'

const props = defineProps<{
  pr: SerializedPullRequest
}>()

const { threadMap } = useCommentSystem()!


const sortedThreadIds = computed(() => {
  const ids = Object.keys(threadMap.value)

  ids.sort((a, b) => {
    const aFirst = threadMap.value[a]?.value.comments[0]
    const bFirst = threadMap.value[b]?.value.comments[0]
    if (!aFirst || !bFirst) return 0
    return new Date(aFirst.created_at).getTime() - new Date(bFirst.created_at).getTime()
  })

  return ids
})

const emit = defineEmits<{
  (e: 'select-file', event: DiffNavigateEvent): void
}>()

const handleSelectFile = (event: DiffNavigateEvent) => {
  emit('select-file', event)
}
</script>
