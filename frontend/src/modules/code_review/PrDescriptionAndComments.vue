<template>
  <div class="h-full overflow-y-auto overflow-x-hidden">
    <PrDescription
      :description="pr?.description ?? null"
      :html-description="pr?.html_description ?? null"
    />

    <Separator class="my-2" />

    <PrComment
      :pr="pr"
      @select-file="$emit('select-file', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { Separator } from '@/components/ui/separator'
import PrDescription from './PrDescription.vue'
import PrComment from '@/modules/comment/PrComment.vue'
import type { SerializedPullRequest, DiffNavigateEvent } from '@/types'

defineProps<{
  pr: SerializedPullRequest
}>()

defineEmits<{
  'select-file': [event: DiffNavigateEvent]
}>()
</script>
