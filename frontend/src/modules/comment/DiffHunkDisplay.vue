<template>
  <div
    v-if="displayLines.length > 0"
    class="mb-2 font-mono rounded overflow-x-auto border wrap-anywhere"
  >
    <table class="w-full">
      <tbody>
        <tr
          v-for="(line, lineIndex) in displayLines"
          :key="lineIndex"
          :class="getLineClass(line.type)"
        >
          <!-- 
            Context/Addition/Deletion Lines
           -->
          <template v-if="line.type !== 'hunk'">
            <td class="w-8 text-right pr-1 select-none text-muted-foreground/50 border-r border-border/50">
              {{ line.oldLineNumber ?? '' }}
            </td>
            <td class="w-8 text-right pr-1 select-none text-muted-foreground/50 border-r border-border/50">
              {{ line.newLineNumber ?? '' }}
            </td>
            <td class="pl-2 pr-2 py-0 break-all whitespace-pre-wrap text-neutral-800">
              <span>
                {{ line.content }}
              </span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { DiffLine } from '@/types'
import { computed } from 'vue'
import { parseDiffHunk } from '@/utils/diffParser'

const props = withDefaults(defineProps<{
  diffHunk: string | null
  maxLines?: number
}>(), {
  maxLines: 10
})

const parsedHunk = computed(() => {
  if (!props.diffHunk) return null

  return parseDiffHunk(props.diffHunk)
})

const displayLines = computed(() => {
  if (!parsedHunk.value) return []

  const lines = parsedHunk.value.lines
  // Skip the hunk header (first line) when counting, then take last maxLines
  const contentLines = lines.slice(1)
  if (contentLines.length <= props.maxLines) {
    return lines
  }
  // Return last maxLines content lines (without the hunk header)
  return contentLines.slice(-props.maxLines)
})

function getLineClass (type: DiffLine['type']): string {
  switch (type) {
    case 'addition':
      return 'bg-emerald-50/50 dark:bg-green-950/50 shadow-[inset_3px_0_0_0_#34d39980]'
    case 'deletion':
      return 'bg-rose-50/50 dark:bg-rose-950/50 shadow-[inset_3px_0_0_0_#f87171]'
    default:
      return ''
  }
}

</script>
