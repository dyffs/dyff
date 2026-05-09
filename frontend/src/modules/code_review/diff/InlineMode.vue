<template>
  <table class="w-full text-[12px] font-mono">
    <colgroup>
      <col :style="{ width: OLD_LINE_COL_WIDTH }">
      <col :style="{ width: NEW_LINE_COL_WIDTH }">
      <col :style="{ width: CONTENT_COL_WIDTH }">
      <col :style="{ width: GUTTER_COL_WIDTH }">
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
            class="bg-neutral-100 dark:bg-blue-950 text-neutral-500 dark:text-blue-300 h-[18px]"
          >
            <td
              colspan="3"
              class="px-4 text-xs"
            >
              {{ line.content }}
            </td>
          </tr>

          <!-- Context/Addition/Deletion Lines -->
          <tr
            v-else
            class="group"
            :class="getLineClass(line.type)"
          >
            <td
              class="text-right pr-2 select-none text-muted-foreground/50 border-r border-border/50 align-top relative"
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
                  oldLineEnd: line.oldLineNumber,
                  newLineStart: line.newLineNumber,
                  newLineEnd: line.newLineNumber
                })"
              />
              {{ line.oldLineNumber ?? '' }}
            </td>
            <td
              class="text-right pr-2 select-none text-muted-foreground/50 border-r border-border/50 align-top"
              :data-line-number="line.newLineNumber"
              data-side="right"
            >
              {{ line.newLineNumber ?? '' }}
            </td>
            <td class="pl-4 pr-4 py-0 break-all whitespace-pre-wrap align-top">
              <span
                :class="[
                  'inline-block w-4',
                  line.type === 'addition' ? 'text-green-700 dark:text-green-400' : '',
                  line.type === 'deletion' ? 'text-red-700 dark:text-red-400' : ''
                ]"
              /><span class="diff-line-content" v-html="line.highlightedContent || line.content" />
            </td>
            <!-- Comment Gutter -->
            <CommentGutter
              v-if="getThreads(file.newPath, line).length > 0"
              :threads="getThreads(file.newPath, line)"
              class="bg-white"
              @select-file="$emit('select-file', $event)"
            />
          </tr>
        </template>
      </template>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import type { FileDiff, DiffLine, AppComment, DiffNavigateEvent } from '@/types'
import type { CommentThread } from '@/modules/comment/types'
import CommentGutter from './CommentGutter.vue'
import { SquarePlus } from 'lucide-vue-next'
import { useContextMenu, type DiffContextMenuData } from '../diff_menu/useContextMenu'

const contextMenu = useContextMenu()!

interface LineThread {
  thread: CommentThread
  threadId: string
  rootComment: AppComment
  replyCount: number
}

interface Props {
  file: FileDiff
  getThreadsForLine: (filePath: string, side: 'LEFT' | 'RIGHT', lineNumber: number | undefined) => LineThread[]
}

const props = defineProps<Props>()

const OLD_LINE_COL_WIDTH = '44px'
const NEW_LINE_COL_WIDTH = '44px'
const CONTENT_COL_WIDTH = 'auto'
const GUTTER_COL_WIDTH = '50px'

defineEmits<{
  'select-file': [event: DiffNavigateEvent]
}>()

const contextMenuTriggerClass = 'absolute right-full -mr-5 top-0 cursor-pointer text-emerald-800 opacity-0 group-hover:opacity-100'

function openContextMenu (event: MouseEvent, data: DiffContextMenuData) {
  const target = event.currentTarget as HTMLElement
  contextMenu.open(target, data)
}

function getThreads (filePath: string, line: DiffLine) {
  return props.getThreadsForLine(filePath, line.newLineNumber ? 'RIGHT' : 'LEFT', line.newLineNumber ?? line.oldLineNumber)
}

function getLineClass (type: DiffLine['type']): string {
  switch (type) {
    case 'addition':
      return 'bg-green-100 dark:bg-green-950/50'
    case 'deletion':
      return 'bg-red-100 dark:bg-red-950/50'
    default:
      return ''
  }
}
</script>
