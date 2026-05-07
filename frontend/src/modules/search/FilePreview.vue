<template>
  <div class="h-full overflow-y-auto">
    <div class="px-4 pb-4 pt-0 h-full flex flex-col">
      <!-- Empty State -->
      <div
        v-if="!selectedFilePath"
        class="flex items-center justify-center h-full text-muted-foreground text-xs"
      >
        File content will appear here
      </div>

      <!-- File Content -->
      <div
        v-else
        class="flex-1 overflow-y-auto flex flex-col mt-2"
      >
        <!-- File Header -->
        <div class="mb-4 pb-2 border-b">
          <div class="flex items-center gap-2">
            <!-- <DevIcon :file-path="selectedFilePath" /> -->
            <h3 class="text-xs wrap-anywhere">
              {{ selectedFilePath }}
            </h3>
            <div
              v-if="matchCount && matchCount > 1"
              class="flex items-center gap-1"
            >
              <Badge class="text-[9px] rounded-sm px-2 py-0.5 bg-white text-primary border border-primary/10">
                Match {{ currentMatchIndex + 1 }}/{{ matchCount }}
              </Badge>
              <button
                class="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                :disabled="matchCount === 0"
                @click="goToPreviousMatch"
              >
                <ChevronUp :size="14" />
              </button>
              <button
                class="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                :disabled="matchCount === 0"
                @click="goToNextMatch"
              >
                <ChevronDown :size="14" />
              </button>
            </div>
            <Badge
              v-if="selectedFileDiff"
              variant="secondary"
              class="bg-green-100 ml-2 text-[9px] rounded-sm px-2 py-0.5 text-green-700 dark:bg-green-950 dark:text-green-400"
            >
              Modified in PR
            </Badge>
          </div>
        </div>

        <!-- Very Large File Warning -->
        <div
          v-if="isVeryLargeFile && !userConfirmedRender"
          class="border rounded flex-1 overflow-y-auto flex items-center justify-center"
        >
          <div class="text-center p-8 max-w-md text-sm">
            <p class="text-muted-foreground mb-4">
              This file is very large ({{ displayLines.length.toLocaleString() }} lines) and may impact performance.
            </p>
            <Button
              variant="outline"
              @click="handleRenderLargeFile"
            >
              Render anyway
            </Button>
          </div>
        </div>

        <!-- Code Display -->
        <div
          v-else
          class="border rounded flex-1 overflow-y-auto"
        >
          <div
            v-if="!fileContent"
            class="flex items-center justify-center py-8 text-muted-foreground"
          >
            File content not available
          </div>
          <div
            v-else
            class="font-mono"
          >
            <table class="w-full">
              <tbody>
                <tr
                  v-for="line in displayLines"
                  :id="`line-${line.displayIndex}`"
                  :key="line.displayIndex"
                  :class="getDisplayLineClass(line)"
                >
                  <td
                    v-if="selectedFileDiff"
                    class="w-8 text-right pr-3 pl-2 py-0.5 select-none text-muted-foreground/50 border-r text-xs"
                  >
                    {{ line.oldLineNumber ?? '' }}
                  </td>
                  <td class="w-8 text-right pr-3 pl-2 py-0.5 select-none text-muted-foreground/50 border-r text-xs">
                    {{ line.newLineNumber ?? '' }}
                  </td>
                  <td class="pl-4 pr-4 py-0.5 whitespace-pre-wrap break-all text-xs">
                    <span v-html="highlightedLines[line.displayIndex] || escapeHtml(line.content)" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, nextTick, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { highlightLine } from '@/utils/syntaxHighlighter'
import { escapeHtml, escapeRegex } from './searchUtils'
import type { FileDiff } from '@/types'
import DevIcon from '@/components/custom/DevIcon.vue'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

export interface DisplayLine {
  content: string
  type: 'context' | 'addition' | 'deletion'
  newLineNumber?: number
  oldLineNumber?: number
  displayIndex: number
}

interface Props {
  selectedFilePath: string | null
  fileContent: string | null
  fileDiff: FileDiff | null
  matchedLines?: number[]
  searchKeyword?: string
}

const props = defineProps<Props>()

const highlightedLines = ref<Record<number, string>>({})
const userConfirmedRender = ref(false)
const currentMatchIndex = ref(0)

const fileContentLines = computed(() => {
  if (!props.fileContent) return []
  return props.fileContent.split('\n')
})

const selectedFileDiff = computed(() => props.fileDiff)

const matchCount = computed(() => props.matchedLines?.length || 0)

const HIGHLIGHT_LINE_THRESHOLD = 2000
const VERY_LARGE_FILE_THRESHOLD = 5000

const isVeryLargeFile = computed(() => displayLines.value.length >= VERY_LARGE_FILE_THRESHOLD)
const shouldRenderFile = computed(() => !isVeryLargeFile.value || userConfirmedRender.value)

// Combined view: full file content + deleted lines inline
const displayLines = computed<DisplayLine[]>(() => {
  if (!selectedFileDiff.value || !fileContentLines.value.length) {
    // No diff, just show the file content normally
    return fileContentLines.value.map((content, index) => ({
      content,
      type: 'context' as const,
      newLineNumber: index + 1,
      displayIndex: index
    }))
  }

  const result: DisplayLine[] = []
  let currentNewLine = 1

  for (const hunk of selectedFileDiff.value.hunks) {
    // Fill in context lines before this hunk starts
    while (currentNewLine < hunk.newStart) {
      result.push({
        content: fileContentLines.value[currentNewLine - 1] || '',
        type: 'context',
        newLineNumber: currentNewLine,
        displayIndex: result.length
      })
      currentNewLine++
    }

    // Process hunk lines
    for (const line of hunk.lines) {
      if (line.type === 'hunk') continue

      if (line.type === 'deletion') {
        // Insert deleted line
        result.push({
          content: line.content,
          type: 'deletion',
          oldLineNumber: line.oldLineNumber,
          displayIndex: result.length
        })
      } else if (line.type === 'addition') {
        result.push({
          content: line.content,
          type: 'addition',
          newLineNumber: line.newLineNumber,
          displayIndex: result.length
        })
        if (line.newLineNumber) {
          currentNewLine = line.newLineNumber + 1
        }
      } else {
        // Context line
        result.push({
          content: line.content,
          type: 'context',
          newLineNumber: line.newLineNumber,
          oldLineNumber: line.oldLineNumber,
          displayIndex: result.length
        })
        if (line.newLineNumber) {
          currentNewLine = line.newLineNumber + 1
        }
      }
    }
  }

  // Fill in remaining context lines after last hunk
  while (currentNewLine <= fileContentLines.value.length) {
    result.push({
      content: fileContentLines.value[currentNewLine - 1] || '',
      type: 'context',
      newLineNumber: currentNewLine,
      displayIndex: result.length
    })
    currentNewLine++
  }

  return result
})

// Reset user confirmation when file changes
watch(() => props.selectedFilePath, () => {
  userConfirmedRender.value = false
  currentMatchIndex.value = 0
})

// Reset current match index when matches change
watch(() => props.matchedLines, () => {
  currentMatchIndex.value = 0
})

// Watch for selected file change to apply highlighting
watch([() => props.selectedFilePath, displayLines, shouldRenderFile], async ([newFilePath, newDisplayLines, shouldRender]) => {
  if (!newFilePath || !newDisplayLines.length) {
    highlightedLines.value = {}
    return
  }

  // Don't render if user hasn't confirmed for very large files
  if (!shouldRender) {
    highlightedLines.value = {}
    return
  }

  // Disable syntax highlighting for large files (>2K lines) for performance
  const isLargeFile = newDisplayLines.length >= HIGHLIGHT_LINE_THRESHOLD

  // Process all display lines in parallel
  const highlightPromises = newDisplayLines.map(async (line) => {
    try {
      // Skip syntax highlighting for large files, just escape HTML
      let highlighted = isLargeFile
        ? escapeHtml(line.content || '')
        : await highlightLine(line.content || '', newFilePath || '')

      // Then apply search match highlighting
      if (props.searchKeyword && isMatchLine(line)) {
        const regex = new RegExp(escapeRegex(props.searchKeyword), 'gi')
        highlighted = highlighted.replace(regex, (match) => {
          return `<mark class="bg-yellow-300 dark:bg-yellow-700 font-semibold">${match}</mark>`
        })
      }

      return highlighted
    } catch (error) {
      console.error('Failed to highlight line:', error)
      return escapeHtml(line.content || '')
    }
  })

  // Wait for all highlighting to complete, then update reactivity once
  const highlightedLinesArray = await Promise.all(highlightPromises)
  const newHighlightedLines: Record<number, string> = {}
  highlightedLinesArray.forEach((highlighted, i) => {
    newHighlightedLines[i] = highlighted
  })
  highlightedLines.value = newHighlightedLines

  // Scroll to current match
  await scrollToMatch(currentMatchIndex.value)
}, {
  immediate: true
})

async function scrollToMatch (matchIndex: number) {
  if (!props.matchedLines || props.matchedLines.length === 0) return

  await nextTick()

  const matchLine = props.matchedLines[matchIndex]
  if (!matchLine) return

  // Find the display line with this line number
  const displayLine = displayLines.value.find(line => line.newLineNumber === matchLine)
  if (!displayLine) return

  const lineElement = document.getElementById(`line-${displayLine.displayIndex}`)

  if (lineElement) {
    lineElement.scrollIntoView({ behavior: 'instant', block: 'center' })
  }
}

function goToNextMatch () {
  if (!props.matchedLines || props.matchedLines.length === 0) return

  currentMatchIndex.value = (currentMatchIndex.value + 1) % props.matchedLines.length
  void scrollToMatch(currentMatchIndex.value)
}

function goToPreviousMatch () {
  if (!props.matchedLines || props.matchedLines.length === 0) return

  currentMatchIndex.value = currentMatchIndex.value === 0
    ? props.matchedLines.length - 1
    : currentMatchIndex.value - 1
  void scrollToMatch(currentMatchIndex.value)
}

// Match Highlighting
function isMatchLine (line: DisplayLine): boolean {
  if (!props.matchedLines || !line.newLineNumber) return false

  return props.matchedLines.includes(line.newLineNumber)
}

// Display Line Styling
function getDisplayLineClass (line: DisplayLine): string {
  const classes: string[] = []

  // Add match highlighting
  if (isMatchLine(line)) {
    classes.push('bg-yellow-50 dark:bg-yellow-950/20')
  }

  // Add diff type styling
  switch (line.type) {
    case 'addition':
      classes.push('bg-green-100 dark:bg-green-950/50')
      break
    case 'deletion':
      classes.push('bg-red-100 dark:bg-red-950/50')
      break
  }

  return classes.join(' ')
}

// Handle user confirmation to render large file
function handleRenderLargeFile () {
  userConfirmedRender.value = true
}
</script>
