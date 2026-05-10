<template>
  <GithubAvatar
    :username="name"
    class="h-5 w-5 ring-1 ring-neutral-300"
  />
</template>
<script setup lang="ts">
import GithubAvatar from './GithubAvatar.vue'

interface Props {
  name: string
}

defineProps<Props>()
</script>