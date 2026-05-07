<template>
  <GithubAvatar
    v-if="origin === 'human' && name"
    :username="name"
    class="h-5 w-5 ring-1 ring-neutral-300"
  />
  <AgentAvatar
    v-else
    :bot-uname="name"
    class="h-5 w-5 ring-1 ring-neutral-300"
  />
</template>
<script setup lang="ts">
import GithubAvatar from './GithubAvatar.vue'
import AgentAvatar from './AgentAvatar.vue'
import type { AppComment } from '@/types'

interface Props {
  origin: AppComment['origin']
  name?: string | null
}

defineProps<Props>()
</script>