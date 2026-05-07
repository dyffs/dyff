<template>
  <div
    v-tooltip="{ content: htmlContent, html: true }"
    class="relative group/reviewer"
  >
    <div
      class="
        w-6 h-6 rounded-full ring ring-border flex items-center justify-center font-medium text-zinc-300 uppercase
      "
    >
      <GithubAvatar
        :username="reviewer"
        class="w-6 h-6"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GithubAvatar from '@/components/custom/GithubAvatar.vue'

interface Props {
  reviewer: string
  currentUsername?: string
}

const props = withDefaults(defineProps<Props>(), {
  currentUsername: '',
})

const isYou = computed(() => props.reviewer === props.currentUsername)

const htmlContent = computed(() => {
  const html = `
    <div class="font-medium">
      ${isYou.value ? 'You' : props.reviewer}
    </div>
  `

  return `<div>${html}</div>`
})
</script>
