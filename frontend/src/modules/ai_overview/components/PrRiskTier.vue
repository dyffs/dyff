<template>
  <div
    class="pr-risk-tier"
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
        @click="collapse = !collapse"
      />
      <Circle
        class="size-2"
        :style="circleColorStyle"
      />
      <span class="font-medium text-[13px]">
        {{ startCase(level) }}
      </span>
      <span class="text-[12px] text-secondary ml-1">
        {{ count }} {{ count && parseInt(count) > 1 ? 'files' : 'file' }}
      </span>
    </div>
    <div
      v-show="!collapse"
      class="pl-6 mt-1"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Triangle, Circle } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { startCase } from 'lodash-es'

const props = defineProps<{
  level?: 'must-inspect' | 'should-inspect' | 'likely-safe'
  count?: string
}>()

const collapse = ref(props.level !== 'must-inspect')

const circleColorStyle = computed<string>(() => {
  switch (props.level) {
    case 'must-inspect':
      return 'fill: #E24B4A; stroke: #E24B4A;'
    case 'should-inspect':
      return 'fill: #EF9F27; stroke: #EF9F27;'
    case 'likely-safe':
      return 'fill: #97C459; stroke: #97C459;'
    default:
      return 'fill: #6B6B6B; stroke: #6B6B6B;'
  }
})

function toggleCollapse () {
  collapse.value = !collapse.value
}

</script>
