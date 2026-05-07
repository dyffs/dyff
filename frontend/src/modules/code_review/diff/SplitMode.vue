<template>
  <div>
    <!-- Added files: show only new side -->
    <table
      v-if="file.status === 'added'"
      class="w-full text-[12px] font-mono table-fixed"
    >
      <colgroup>
        <col :style="{ width: SINGLE_LINE_COL_WIDTH }">
        <col :style="{ width: SINGLE_LINE_CONTENT_COL_WIDTH }">
        <col :style="{ width: SINGLE_GUTTER_COL_WIDTH }">
      </colgroup>
      <tbody>
        <template
          v-for="(hunk, hunkIndex) in file.hunks"
          :key="hunkIndex"
        >
          <template
            v-for="(line, lineIndex) in hunk.lines"
            :key="`${hunkIndex}-${lineIndex}`"
          >
            <!-- Hunk Header -->
            <tr
              v-if="line.type === 'hunk'"
              class="bg-neutral-100 text-neutral-500 h-[18px]"
            >
              <td
                colspan="3"
                class="px-4 text-xs"
              >
                {{ line.content }}
              </td>
            </tr>

            <!-- Addition/Context Lines -->
            <tr
              v-else
              class="group"
              :class="line.type === 'addition' ? 'bg-green-100 dark:bg-green-950/50' : ''"
            >
              <td
                class="text-right pr-1 select-none text-muted-foreground/50 border-r border-border/50 align-top relative"
                :class="line.type === 'addition' ? getAccentBarClass('addition') : ''"
                :data-line-number="line.newLineNumber"
                data-side="right"
              >
                <SquarePlus
                  :size="16"
                  :class="contextMenuTriggerClass"
                  @click="(e) => openContextMenu(e, {
                    filePath: file.newPath,
                    fileDiff: file,
                    newLineStart: line.newLineNumber,
                    newLineEnd: line.newLineNumber
                  })"
                />
                {{ line.newLineNumber ?? '' }}
              </td>
              <td class="pl-4 pr-4 py-0 break-all whitespace-pre-wrap align-top">
                <span class="diff-line-content" v-html="line.highlightedContent || line.content" />
              </td>
              <CommentGutter
                v-if="getThreadsForLine(file.newPath, 'RIGHT', line.newLineNumber).length > 0"
                :threads="getThreadsForLine(file.newPath, 'RIGHT', line.newLineNumber)"
                class="bg-white"
                @select-file="$emit('select-file', $event)"
              />
            </tr>
          </template>
        </template>
      </tbody>
    </table>

    <!-- Deleted files: show only old side -->
    <table
      v-else-if="file.status === 'deleted'"
      class="w-full text-[13px] font-mono table-fixed"
    >
      <colgroup>
        <col :style="{ width: SINGLE_LINE_COL_WIDTH }">
        <col :style="{ width: SINGLE_LINE_CONTENT_COL_WIDTH }">
        <col :style="{ width: SINGLE_GUTTER_COL_WIDTH }">
      </colgroup>
      <tbody>
        <template
          v-for="(hunk, hunkIndex) in file.hunks"
          :key="hunkIndex"
        >
          <template
            v-for="(line, lineIndex) in hunk.lines"
            :key="`${hunkIndex}-${lineIndex}`"
          >
            <!-- Hunk Header -->
            <tr
              v-if="line.type === 'hunk'"
              class="bg-neutral-100 text-neutral-500 h-[18px]"
            >
              <td
                colspan="3"
                class="px-4 text-xs"
              >
                {{ line.content }}
              </td>
            </tr>

            <!-- Deletion/Context Lines -->
            <tr
              v-else
              class="group"
              :class="line.type === 'deletion' ? 'bg-red-100 dark:bg-red-950/50' : ''"
            >
              <td
                class="text-right pr-1 select-none text-muted-foreground/50 border-r border-border/50 align-top relative"
                :class="line.type === 'deletion' ? getAccentBarClass('deletion') : ''"
                :data-line-number="line.oldLineNumber"
                data-side="left"
              >
                <SquarePlus
                  :size="16"
                  :class="contextMenuTriggerClass"
                  @click="(e) => openContextMenu(e, {
                    filePath: file.newPath,
                    fileDiff: file,
                    oldLineStart: line.oldLineNumber,
                    oldLineEnd: line.oldLineNumber
                  })"
                />
                {{ line.oldLineNumber ?? '' }}
              </td>
              <td class="pl-4 pr-4 py-0 break-all whitespace-pre-wrap align-top">
                <span class="diff-line-content" v-html="line.highlightedContent || line.content" />
              </td>
              <CommentGutter
                v-if="getThreadsForLine(file.newPath, 'LEFT', line.oldLineNumber).length > 0"
                :threads="getThreadsForLine(file.newPath, 'LEFT', line.oldLineNumber)"
                class="bg-white"
                @select-file="$emit('select-file', $event)"
              />
            </tr>
          </template>
        </template>
      </tbody>
    </table>

    <!-- Modified/Renamed files: show both sides with paired rows -->
    <table
      v-else
      ref="splitTableRef"
      class="w-full text-[13px] font-mono table-fixed"
      @mousedown="onMouseDown"
    >
      <colgroup>
        <col :style="{ width: PAIRED_OLD_LINE_COL_WIDTH }">
        <col :style="{ width: PAIRED_OLD_LINE_CONTENT_COL_WIDTH }">
        <col :style="{ width: PAIRED_GUTTER_COL_WIDTH }">
        <col :style="{ width: PAIRED_NEW_LINE_COL_WIDTH }">
        <col :style="{ width: PAIRED_NEW_LINE_CONTENT_COL_WIDTH }">
        <col :style="{ width: PAIRED_GUTTER_COL_WIDTH }">
      </colgroup>
      <tbody>
        <template
          v-for="(hunk, hunkIndex) in file.hunks"
          :key="hunkIndex"
        >
          <template
            v-for="(row, rowIndex) in getPairedRows(hunk.lines)"
            :key="`${hunkIndex}-${rowIndex}`"
          >
            <!-- Hunk Header -->
            <tr
              v-if="row.type === 'hunk'"
              class="bg-neutral-100 text-neutral-500 h-[18px]"
            >
              <td
                colspan="6"
                class="px-4 text-xs"
              >
                {{ row.leftLine?.content }}
              </td>
            </tr>

            <!-- Context Lines (show on both sides) -->
            <tr
              v-else-if="row.type === 'context'"
              class="group"
            >
              <!-- Old side -->
              <td class="text-right pr-1 select-none text-muted-foreground/50 border-r border-border/50 align-top relative">
                {{ row.leftLine?.oldLineNumber ?? '' }}
              </td>
              <td
                data-side="left"
                :data-line-number="row.leftLine?.oldLineNumber"
                class="pl-4 pr-4 py-0 break-all whitespace-pre-wrap border-r-2 border-border/30 align-top"
              >
                <span class="diff-line-content" v-html="row.leftLine?.highlightedContent || row.leftLine?.content" />
              </td>
              <td class="border-r-2 border-border/30" />
              <!-- New side -->
              <td class="text-right pr-1 select-none text-muted-foreground/50 border-r border-border/50 align-top relative">
                <SquarePlus
                  :size="16"
                  :class="contextMenuTriggerClass"
                  @click="(e) => openContextMenu(e, {
                    filePath: file.newPath,
                    fileDiff: file,
                    newLineStart: row.rightLine?.newLineNumber,
                    newLineEnd: row.rightLine?.newLineNumber
                  })"
                />
                {{ row.rightLine?.newLineNumber ?? '' }}
              </td>
              <td
                data-side="right"
                :data-line-number="row.rightLine?.newLineNumber"
                class="pl-4 pr-4 py-0 break-all whitespace-pre-wrap border-r-2 border-border/30 align-top"
              >
                <span class="diff-line-content" v-html="row.rightLine?.highlightedContent || row.rightLine?.content" />
              </td>
              <CommentGutter
                v-if="getThreadsForLine(file.newPath, 'RIGHT', row.rightLine?.newLineNumber).length > 0"
                :threads="getThreadsForLine(file.newPath, 'RIGHT', row.rightLine?.newLineNumber)"
                border-class="border-l border-border/50"
                @select-file="$emit('select-file', $event)"
              />
            </tr>

            <!-- Paired deletion/addition rows -->
            <tr
              v-else-if="row.type === 'paired'"
              class="group"
            >
              <!-- Old side (deletion or empty) -->
              <td
                :class="[
                  'text-right pr-1 select-none text-muted-foreground/50 border-r border-border/50 relative align-top',
                  row.leftLine ? getAccentBarClass('deletion') : 'bg-muted/20'
                ]"
              >
                <SquarePlus
                  v-if="row.leftLine"
                  :size="16"
                  :class="contextMenuTriggerClass"
                  @click="(e) => openContextMenu(e, {
                    filePath: file.newPath,
                    fileDiff: file,
                    oldLineStart: row.leftLine?.oldLineNumber,
                    oldLineEnd: row.leftLine?.oldLineNumber
                  })"
                />
                {{ row.leftLine?.oldLineNumber ?? '' }}
              </td>
              <td
                data-side="left"
                :data-line-number="row.leftLine?.oldLineNumber"
                :class="[
                  'pl-4 pr-4 py-0 align-top',
                  row.leftLine ? 'bg-red-100 dark:bg-red-950/50 break-all whitespace-pre-wrap' : 'bg-muted/20'
                ]"
              >
                <template v-if="row.leftLine">
                  <span class="diff-line-content" v-html="row.leftLine.highlightedContent || row.leftLine.content" />
                </template>
              </td>
              <CommentGutter
                v-if="row.leftLine && getThreadsForLine(file.newPath, 'LEFT', row.leftLine.oldLineNumber).length > 0"
                :threads="getThreadsForLine(file.newPath, 'LEFT', row.leftLine.oldLineNumber)"
                @select-file="$emit('select-file', $event)"
              />
              <td
                v-else
                class="bg-muted/20"
              />
              <!-- New side (addition or empty) -->
              <td
                :class="[
                  'text-right pr-1 select-none text-muted-foreground/50 border-r border-border/50 align-top relative',
                  row.rightLine ? getAccentBarClass('addition') : 'bg-muted/20'
                ]"
              >
                <SquarePlus
                  v-if="row.rightLine"
                  :size="16"
                  :class="contextMenuTriggerClass"
                  @click="(e) => openContextMenu(e, {
                    filePath: file.newPath,
                    fileDiff: file,
                    newLineStart: row.rightLine?.newLineNumber,
                    newLineEnd: row.rightLine?.newLineNumber
                  })"
                />
                {{ row.rightLine?.newLineNumber ?? '' }}
              </td>
              <td
                data-side="right"
                :data-line-number="row.rightLine?.newLineNumber"
                :class="[
                  'pl-4 pr-4 py-0 align-top',
                  row.rightLine ? 'bg-green-100 dark:bg-green-950/50 break-all whitespace-pre-wrap' : 'bg-muted/20'
                ]"
              >
                <template v-if="row.rightLine">
                  <span class="diff-line-content" v-html="row.rightLine.highlightedContent || row.rightLine.content" />
                </template>
              </td>
              <CommentGutter
                v-if="row.rightLine && getThreadsForLine(file.newPath, 'RIGHT', row.rightLine.newLineNumber).length > 0"
                :threads="getThreadsForLine(file.newPath, 'RIGHT', row.rightLine.newLineNumber)"
                border-class="border-l border-border/50"
                @select-file="$emit('select-file', $event)"
              />
              <td
                v-else
                class="bg-muted/20"
              />
            </tr>
          </template>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FileDiff, DiffLine, AppComment, DiffNavigateEvent } from '@/types'
import type { CommentThread } from '@/modules/comment/useComments'
import CommentGutter from './CommentGutter.vue'
import { SquarePlus } from 'lucide-vue-next'

import { useContextMenu, type DiffContextMenuData } from '../diff_menu/useContextMenu'

const contextMenu = useContextMenu()!

// Selection isolation: prevent cross-side text selection in split view
const splitTableRef = ref<HTMLTableElement>()
const selectingSide = ref<'left' | 'right' | null>(null)

function onMouseDown (e: MouseEvent) {
  const target = e.target as HTMLElement
  const cell = target.closest<HTMLElement>('[data-side]')
  if (!splitTableRef.value || !cell) return

  const side = cell.dataset.side as 'left' | 'right'

  // Same side - no change needed
  if (selectingSide.value === side) return

  // Reset previous restriction and apply new one
  splitTableRef.value.querySelectorAll<HTMLElement>('[data-side]').forEach((el) => {
    el.style.userSelect = el.dataset.side === side ? '' : 'none'
  })
  selectingSide.value = side
}

interface LineThread {
  thread: CommentThread
  threadId: string
  rootComment: AppComment
  replyCount: number
}

interface PairedRow {
  type: 'context' | 'hunk' | 'paired'
  leftLine?: DiffLine   // deletion or context line (old side)
  rightLine?: DiffLine  // addition or context line (new side)
}

const SINGLE_LINE_COL_WIDTH = '44px'
const SINGLE_LINE_CONTENT_COL_WIDTH = 'auto'
const SINGLE_GUTTER_COL_WIDTH = '50px'

const PAIRED_OLD_LINE_COL_WIDTH = '44px'
const PAIRED_OLD_LINE_CONTENT_COL_WIDTH = 'auto'
const PAIRED_NEW_LINE_COL_WIDTH = '44px'
const PAIRED_NEW_LINE_CONTENT_COL_WIDTH = 'auto'
const PAIRED_GUTTER_COL_WIDTH = '44px'

interface Props {
  file: FileDiff
  getThreadsForLine: (filePath: string, side: 'LEFT' | 'RIGHT', lineNumber: number | undefined) => LineThread[]
}

defineProps<Props>()

defineEmits<{
  'select-file': [event: DiffNavigateEvent]
}>()

const contextMenuTriggerClass = 'absolute right-full -mr-5 top-0.5 cursor-pointer text-emerald-800 opacity-0 group-hover:opacity-100'

function openContextMenu (event: MouseEvent, data: DiffContextMenuData) {
  const target = event.currentTarget as HTMLElement
  contextMenu.open(target, data)
}


// Accent bar colors for diff lines
const ACCENT_BAR = {
  addition: {
    light: 'shadow-[inset_3px_0_0_0_#34d399]', // emerald-400
    dark: 'dark:shadow-[inset_3px_0_0_0_#34d399]',
  },
  deletion: {
    light: 'shadow-[inset_3px_0_0_0_#f87171]',
    dark: 'dark:shadow-[inset_3px_0_0_0_#f87171]',
  },
} as const

function getAccentBarClass (type: 'addition' | 'deletion'): string {
  const accent =  `${ACCENT_BAR[type].light} ${ACCENT_BAR[type].dark}`
  const bg = type === 'addition' ? 'bg-green-100 dark:bg-green-950/50' : 'bg-red-100 dark:bg-red-950/50'
  return `${accent} ${bg}`
}

/**
 * Transform a flat list of diff lines into paired rows for split view display.
 * This pairs consecutive deletions with consecutive additions side-by-side,
 * similar to GitHub's split diff view.
 */
function getPairedRows (lines: DiffLine[]): PairedRow[] {
  const result: PairedRow[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Handle hunk headers
    if (line!.type === 'hunk') {
      result.push({ type: 'hunk', leftLine: line })
      i++
      continue
    }

    // Handle context lines
    if (line!.type === 'context') {
      result.push({ type: 'context', leftLine: line, rightLine: line })
      i++
      continue
    }

    // Collect consecutive deletions
    const deletions: DiffLine[] = []
    while (i < lines.length && lines[i]!.type === 'deletion') {
      deletions.push(lines[i]!)
      i++
    }

    // Collect consecutive additions
    const additions: DiffLine[] = []
    while (i < lines.length && lines[i]!.type === 'addition') {
      additions.push(lines[i]!)
      i++
    }

    // Pair deletions with additions
    const maxPairs = Math.max(deletions.length, additions.length)
    for (let j = 0; j < maxPairs; j++) {
      result.push({
        type: 'paired',
        leftLine: deletions[j],   // undefined if no more deletions
        rightLine: additions[j],  // undefined if no more additions
      })
    }
  }

  return result
}
</script>