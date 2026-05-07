<template>
  <div
    ref="containerRef"
    class="flex flex-col gap-2"
  >
    <!-- Search Input -->
    <div class="space-y-2 shrink-0">
      <div ref="anchorRef">
        <Label for="file-name">File Name</Label>
        <Input
          id="file-name"
          ref="fileNameInputRef"
          v-model="fileNameQuery"
          placeholder="Search file names..."
          :disabled="isPreparing"
          class="mt-1 text-xs px-2 py-1 h-8 rounded-sm"
          @keydown.arrow-down.prevent="navigateDown"
          @keydown.arrow-up.prevent="navigateUp"
        />
      </div>

      <!-- Status Bar -->
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <div
          v-if="isPreparing"
          class="flex items-center gap-2"
        >
          <Spinner class="size-3" />
          <span>Preparing file index...</span>
        </div>
      </div>
    </div>

    <div
      v-if="filteredFiles && filteredFiles.length > 0"
      class="border-t pt-2"
    >
      <RecycleScroller
        :items="filteredFiles"
        :item-size="28"
        key-field="path"
        class="outline-none border-none h-full max-h-[520px]"
        tabindex="0"
        @keydown.arrow-down.prevent="navigateDown"
        @keydown.arrow-up.prevent="navigateUp"
      >
        <template #default="{ item, index }">
          <div
            :class="[
              'px-3 py-1 rounded cursor-pointer transition-colors mr-1 my-0.5',
              selectedFileIndex === index
                ? 'bg-neutral-200/50'
                : 'hover:bg-accent/50'
            ]"
            @click="selectFile(index)"
          >
            <div class="flex items-center gap-2 min-w-0">
              <DevIcon :file-path="item.path" />
              <HighlightedText
                :text="item.path"
                :match-positions="item.matchPositions"
              />
              <span
                v-if="files?.some(f => f.newPath === item.path)"
                class="shrink-0 size-1.5 rounded-full bg-green-500"
                title="Modified in PR"
              />
            </div>
          </div>
        </template>
      </RecycleScroller>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useCodeSearch, type FileSearchResult } from './useCodeSearch'
import DevIcon from '@/components/custom/DevIcon.vue'
import HighlightedText from './HighlightedText.vue'
import type { FileDiff } from '@/types'
import type { FileSearchState } from './searchTypes'


interface Props {
  initialFileNameQuery?: string
  files?: FileDiff[]
}

const props = defineProps<Props>()
const fileNameInputRef = ref<HTMLInputElement | null>(null)

const emit = defineEmits<{
  'file-selected': [data: {
    filePath: string
    fileContent: string | null
    fileDiff: FileDiff | null
  }]
}>()

const { isPreparing, searchFilesByName, getFileContent } = useCodeSearch()!

// State
const fileNameQuery = ref(props.initialFileNameQuery || '')
const filteredFiles = ref<FileSearchResult[] | null>(null)
const selectedFileIndex = ref<number>(-1)

// Computed
const selectedFilePath = computed(() => {
  if (selectedFileIndex.value >= 0 && filteredFiles.value) {
    return filteredFiles.value[selectedFileIndex.value]?.path || null
  }
  return null
})

// Search logic
const performSearch = useDebounceFn(() => {
  if (!fileNameQuery.value || fileNameQuery.value.length < 1) {
    filteredFiles.value = null
    return
  }

  // Disable preview file because it's expensive to render while
  // the selectedFile is changing rapidly
  selectedFileIndex.value = -1

  const results = searchFilesByName(fileNameQuery.value)
  filteredFiles.value = results

  if (filteredFiles.value?.length === 1) {
    selectedFileIndex.value = 0
  }
}, 50)

watch(fileNameQuery, () => {
  void performSearch()
}, { immediate: true })

// Watch for initial prop changes (when parent updates state)
watch(() => props.initialFileNameQuery, (newVal) => {
  if (newVal !== undefined && newVal !== fileNameQuery.value) {
    fileNameQuery.value = newVal
  }
}, { immediate: true })


function emitFileSelected (filePath: string) {
  if (!filePath) return
  const fileContent = getFileContent(filePath) || null
  const fileDiff = props.files?.find(f => f.newPath === filePath) || null
  emit('file-selected', {
    filePath,
    fileContent,
    fileDiff
  })
}

// Watch for selection changes and emit to parent
watch(selectedFilePath, (filePath) => {
  if (!filePath) return
  emitFileSelected(filePath)
})

// Navigation
function navigateDown () {
  if (filteredFiles.value && selectedFileIndex.value < filteredFiles.value.length - 1) {
    selectedFileIndex.value++
  }
}

function navigateUp () {
  if (selectedFileIndex.value > 0) {
    selectedFileIndex.value--
  }
}

function selectFile (index: number) {
  selectedFileIndex.value = index
}

// Expose state for parent to retrieve
defineExpose({
  getState: (): FileSearchState => ({
    fileNameQuery: fileNameQuery.value
  }),
  clearState: () => {
    fileNameQuery.value = ''
    filteredFiles.value = null
    selectedFileIndex.value = -1
  },
  focus: () => {
    fileNameInputRef.value?.focus()
  }
})

</script>
