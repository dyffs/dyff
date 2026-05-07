<template>
  <div>
    <!-- Folder Node -->
    <div
      v-if="node.type === 'folder'"
      class="select-none"
    >
      <div
        class="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm"
        :style="{ paddingLeft: `${depth * 8}px` }"
        @click="$emit('toggleFolder', node.path)"
      >
        <ChevronRight
          class="size-2.5 text-muted-foreground shrink-0 transition-transform duration-150"
          :class="{ 'rotate-90': node.isExpanded }"
        />
        <Folder
          v-if="!node.isExpanded"
          class="size-4 text-neutral-400 shrink-0"
        />
        <FolderOpen
          v-else
          class="size-4 text-neutral-400 shrink-0"
        />
        <span class="break-all text-xs flex-initial">{{ node.name }}</span>
        <Check
          v-if="isFolderFullyReviewed(node)"
          class="size-3 text-green-600 dark:text-green-400 shrink-0"
        />
      </div>

      <!-- Children -->
      <div
        v-if="node.isExpanded && node.children"
        class="overflow-hidden"
      >
        <FileTreeNode
          v-for="child in node.children"
          :key="child.path"
          :node="child"
          :depth="depth + 1"
          :selected-file-id="selectedFileId"
          @select-file="$emit('selectFile', $event)"
          @toggle-folder="$emit('toggleFolder', $event)"
        />
      </div>
    </div>

    <!-- File Node -->
    <div
      v-else
      class="flex items-start gap-2 px-2 py-1 rounded cursor-pointer text-sm group"
      :class="[
        selectedFileId === node.fileDiff?.id
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50',
        node.fileDiff && codeReview.isFileReviewed(node.fileDiff.newPath) ? 'opacity-60' : ''
      ]"
      :style="{ paddingLeft: `${depth * 8 + 12}px` }"
      @click="node.fileDiff && handleFileNodeClick(node.fileDiff)"
    >
      <!-- File icon from devicon -->
      <i
        :class="[getFileIconClass(node.name), 'text-xs shrink-0 grayscale-50 mt-0.5']"
      />

      <div class="flex items-center gap-1 flex-1">
        <div class="flex items-center gap-1 flex-1">
          <!-- File name -->
          <span class="break-all flex-initial text-xs">{{ node.name }}</span>

          <!-- Reviewed indicator -->
          <Check
            v-if="node.fileDiff && codeReview.isFileReviewed(node.fileDiff.newPath)"
            class="size-3 text-green-600 dark:text-green-400 shrink-0"
          />
        </div>

        <!-- Status indicator -->
        <span
          v-if="node.fileDiff"
          :class="[
            'text-xs font-medium shrink-0',
            getStatusColorClass(node.fileDiff.status)
          ]"
        >
          {{ getStatusIcon(node.fileDiff.status) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check, ChevronRight, Folder, FolderOpen } from 'lucide-vue-next'
import { getFileIcon } from '@/utils/fileIcons'
import { useCodeReview } from '@/modules/code_review/useCodeReview'
import type { FileDiff, FileTreeNode as FileTreeNodeType, DiffNavigateEvent } from '@/types'

const codeReview = useCodeReview()!

interface Props {
  node: FileTreeNodeType
  depth: number
  selectedFileId: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  selectFile: [event: DiffNavigateEvent]
  toggleFolder: [path: string]
}>()

function getFileIconClass (fileName: string): string {
  return getFileIcon(fileName)
}

function getStatusColorClass (status: FileDiff['status']): string {
  switch (status) {
    case 'added':
      return 'text-green-600 dark:text-green-400'
    case 'deleted':
      return 'text-red-600 dark:text-red-400'
    case 'renamed':
      return 'text-blue-600 dark:text-blue-400'
    default:
      return 'text-yellow-600 dark:text-yellow-400'
  }
}

function getStatusIcon (status: FileDiff['status']): string {
  switch (status) {
    case 'added':
      return '+'
    case 'deleted':
      return '-'
    case 'renamed':
      return '→'
    default:
      return '~'
  }
}

function handleFileNodeClick (fileDiff: FileDiff): void {
  emit('selectFile', {
    fileId: fileDiff.id,
    line: { lineNumber: 0, side: 'RIGHT' },
    options: {
      flashing: true,
      expanded: true
    }
  })
}

function isFolderFullyReviewed (node: FileTreeNodeType): boolean {
  if (node.type === 'file') {
    return node.fileDiff ? codeReview.isFileReviewed(node.fileDiff.newPath) : false
  }

  // For folders, check if all children (recursively) are reviewed
  if (!node.children || node.children.length === 0) {
    return false
  }

  return node.children.every(child => isFolderFullyReviewed(child))
}
</script>