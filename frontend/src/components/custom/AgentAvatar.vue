<template>
  <div :class="cn('rounded-md border border-neutral-200 h-5 w-5 flex items-center justify-center', className)">
    <img
      :src="`https://api.dicebear.com/9.x/bottts/svg?seed=${botUname}`"
      class="h-full w-full"
    >
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  botUname?: string | null
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  botUname: 'reviewbot',
  className: '',
})
</script>