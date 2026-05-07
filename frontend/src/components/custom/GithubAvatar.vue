<template>
  <Avatar
    v-if="style === 'circle'"
    :class="cn('h-8 w-8', className)"
  >
    <AvatarImage
      :src="avatarUrl ?? `https://github.com/${username}.png`"
      :alt="username"
      class="grayscale-40"
    />
    <AvatarFallback class="text-xs">{{ username.slice(0, 2).toUpperCase() }}</AvatarFallback>
  </Avatar>
  <div v-else>
    <img
      :src="avatarUrl ?? `https://github.com/${username}.png`"
      :alt="username"
      :class="cn('rounded-md border border-neutral-200', className)"
    >
  </div>
</template>

<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface Props {
  username: string
  avatarUrl?: string | null
  className?: string
  style?: 'circle' | 'square'
}

const props = withDefaults(defineProps<Props>(), {
  style: 'circle',
  className: '',
  avatarUrl: null,
})
</script>
