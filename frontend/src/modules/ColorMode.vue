<template>
  <div>
    <button
      class="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
      @click="mode = mode === 'dark' ? 'light' : 'dark'"
    >
      {{ mode }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useColorMode } from '@vueuse/core'

const mode = useColorMode()

</script>