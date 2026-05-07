<template>
  <div
    v-if="hasProgress"
    class="flex flex-col gap-1.5 text-xs text-muted-foreground animate-pulse"
  >
    <div
      v-show="agentText"
      class="flex items-center gap-1 break-all"
    >
      <span>{{ agentText }}</span>
    </div>
    <div
      v-show="activeToolCalls.length > 0"
    >
      <div
        v-for="(tc, index) in activeToolCalls"
        :key="index"
        class="flex items-center gap-1"
      >
        <span>{{ formatToolName(tc.name) }}
          {{ tc.input ? '' : '' }}
          {{ tc.input }}
        </span>
      </div>
    </div>
  </div>
  <div
    v-else
    class="flex items-center gap-1 text-muted-foreground text-xs animate-pulse"
  >
    <span>Thinking...</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { get } from 'lodash-es'
import type { SessionProgress } from './types'

const props = defineProps<{
  progress: SessionProgress | null | undefined
}>()

function formatToolInput (toolName: string, input: any): string {
  switch (toolName) {
    case 'list_files':
      return get(input, 'path')
    case 'read_file':
      return get(input, 'path')
    case 'diff_overview':
      return ''
    case 'diff_content':
      return get(input, 'file_paths', []).join(', ')
    case 'search_code':
      return get(input, 'pattern')
    case 'search_files':
      return get(input, 'pattern')
    case 'add_finding':
    case 'update_summary':
    case 'review_notes':
      return ''
    default:
      return ''
  }
}

const lastStep = computed(() => {
  const steps = props.progress?.steps
  if (!steps || steps.length === 0) return null
  return steps[steps.length - 1] ?? null
})

const agentText = computed(() => lastStep.value?.text ?? '')

const activeToolCalls = computed(() => {
  const step = lastStep.value
  if (!step) return []
  return step.toolCalls.map((tc) => ({
    name: tc.toolName,
    input: formatToolInput(tc.toolName, tc.input),
  }))
})

const hasProgress = computed(() => Boolean(agentText.value) || activeToolCalls.value.length > 0)

function formatToolName (name: string): string {
  if (!name) return ''

  // Convert snake_case or camelCase tool names to friendly text
  const friendly = name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
  return friendly
}
</script>
