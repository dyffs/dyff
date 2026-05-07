<template>
  <div
    class="pr-finding"
    :class="{ 'mb-6': !collapse, 'mb-2': collapse }"
  >
    <div
      class="header flex items-top gap-2 cursor-pointer"
      @click="toggleCollapse"
    >
      <Triangle
        class="size-2 mt-1.5 fill-neutral-600 transition-transform duration-200"
        :class="{
          'rotate-180': !collapse,
          'rotate-90': collapse,
        }"
      />
      
      <span class="font-medium text-[13px]">
        {{ index ? `${index}. ` : '' }}{{ title }}
      </span>
      <div>
        <span
          class="shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded"
          :class="severityClass"
        >
          {{ severity }}
        </span>
      </div>
    </div>
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
import { computed, ref } from 'vue'

const props = defineProps<{
  index?: string
  severity?: string
  title?: string
}>()

const collapse = ref(false)

const severityClass = computed(() => {
  switch (props.severity?.toLowerCase()) {
    case 'critical':
      return 'bg-red-100 text-red-700'
    case 'improvement':
      return 'bg-blue-100 text-blue-600'
    default:
      return 'bg-neutral-100 text-neutral-700'
  }
})

function toggleCollapse () {
  collapse.value = !collapse.value
}
</script>
