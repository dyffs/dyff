<template>
  <div class="flex justify-between wrap-anywhere items-center mb-2">
    <div class="flex gap-1" />
    <label class="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
      <Checkbox v-model:model-value="showBotComments" />
      Show bot comments
    </label>
  </div>
</template>

<script setup lang="ts">
import { Checkbox } from '@/components/ui/checkbox'
import { useCommentConfig } from './useCommentConfig'

const config = useCommentConfig()
if (!config) {
  throw new Error('CommentConfig must be used within a CommentConfig provider')
}

const { showBotComments } = config

</script>
