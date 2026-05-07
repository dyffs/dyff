<template>
  <i
    v-if="icon"
    :class="icon"
    class="text-xs shrink-0 w-3 h-3"
  />
  <i
    v-else
    class="w-3 h-3 text-muted-foreground"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-file-text-icon lucide-file-text"
    ><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>
  </i>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getFileIconClass } from '@/modules/search/searchUtils'

const props = defineProps<{
  filePath: string
}>()

const icon = computed(() => {
  return getFileIconClass(props.filePath) || null
})
</script>