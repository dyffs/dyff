<template>
  <span
    class="text-xs truncate text-left"
    dir="rtl"
  >
    <bdo dir="ltr">
      <template
        v-for="(segment, index) in segments"
        :key="index"
      >
        <span
          v-if="segment.highlight"
          class="bg-blue-500/20 text-blue-900"
        >{{ segment.text }}</span>
        <span v-else>{{ segment.text }}</span>
      </template>
    </bdo>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  text: string
  matchPositions: number[]
}

const props = defineProps<Props>()

interface Segment {
  text: string
  highlight: boolean
}

const segments = computed<Segment[]>(() => {
  if (!props.matchPositions.length) {
    return [{ text: props.text, highlight: false }]
  }

  const result: Segment[] = []
  const posSet = new Set(props.matchPositions)
  let currentSegment = ''
  let isHighlighted = false

  for (let i = 0; i < props.text.length; i++) {
    const char = props.text.charAt(i)
    const shouldHighlight = posSet.has(i)

    if (shouldHighlight !== isHighlighted) {
      // Transition point - save current segment
      if (currentSegment) {
        result.push({ text: currentSegment, highlight: isHighlighted })
      }
      currentSegment = char
      isHighlighted = shouldHighlight
    } else {
      currentSegment += char
    }
  }

  // Push the last segment
  if (currentSegment) {
    result.push({ text: currentSegment, highlight: isHighlighted })
  }

  return result
})
</script>
