<template>
  <div
    class="pr-group"
    :class="{ 'mb-6': !collapse, 'mb-1': collapse }"
  >
    <div
      class="header flex items-center gap-2 cursor-pointer"
      @click="toggleCollapse"
    >
      <Triangle
        class="size-2 fill-neutral-600 transition-transform duration-200"
        :class="{
          'rotate-180': !collapse,
          'rotate-90': collapse,
        }"
      />
      <span class="font-medium text-[13px]">
        {{ title }}
      </span>
    </div>
    <p
      v-if="description && !collapse"
      class="text-[12px] text-secondary pl-4 mt-1"
    >
      {{ description }}
    </p>
    <div
      v-show="!collapse"
      class="pl-4 mt-1"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Triangle } from 'lucide-vue-next'
import { ref } from 'vue'

defineProps<{
  title?: string
  description?: string
  id?: string
}>()

const collapse = ref(false)

function toggleCollapse () {
  collapse.value = !collapse.value
}
</script>
