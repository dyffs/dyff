<template>
  <div
    ref="containerRef"
    class="flex flex-col gap-2"
  >
    <!-- Search Inputs -->
    <div class="space-y-2 shrink-0">
      <div class="flex items-center gap-2">
        <Label
          for="keyword"
          class="text-xs text-muted-foreground"
        >Keyword</Label>
        <Input
          id="keyword"
          ref="keywordInputRef"
          v-model="searchKeyword"
          placeholder="Enter search term..."
          :disabled="isPreparing"
          class="mt-1 text-xs px-2 py-1 h-8 rounded-sm"
          @keydown.tab.prevent="focusFilePattern"
          @keydown.arrow-down.prevent="navigateDown"
          @keydown.arrow-up.prevent="navigateUp"
        />
      </div>
      <div
        ref="anchorRef"
        class="flex items-center gap-2"
      >
        <Label
          for="pattern"
          class="text-xs text-muted-foreground whitespace-nowrap mr-2"
        >Pattern</Label>
        <Input
          id="pattern"
          ref="filePatternInputRef"
          v-model="filePattern"
          placeholder="e.g., *.ts, *.vue"
          :disabled="isPreparing"
          class="mt-1 text-xs px-2 py-1 h-8 rounded-sm"
          @keydown.tab.prevent="focusSearchKeyword"
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
          <span>Preparing search index...</span>
        </div>
        <div
          v-else-if="isSearching"
          class="flex items-center gap-2"
        >
          <Spinner class="size-3" />
          <span>Searching...</span>
        </div>
      </div>
    </div>

    <div
      v-if="searchResults && searchResults.results.length > 0"
      class="border-t pt-2"
    >
      <RecycleScroller
        :items="searchResults.results"
        :item-size="28"
        key-field="filePath"
        class="outline-none border-none h-full max-h-[520px]"
        tabindex="0"
        @keydown.arrow-down.prevent="navigateDown"
        @keydown.arrow-up.prevent="navigateUp"
      >
        <template #default="{ item, index }">
          <div
            :class="[
              'px-3 py-1.5 rounded cursor-pointer transition-colors mr-1',
              selectedFileIndex === index
                ? 'bg-neutral-200/50'
                : 'hover:bg-accent/50'
            ]"
            @click="selectFile(index)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <DevIcon :file-path="item.filePath" />
                <span
                  class="text-xs truncate text-left"
                  dir="rtl"
                >
                  <bdo dir="ltr">{{ item.filePath }}</bdo>
                </span>
                <span
                  v-if="files?.some(f => f.newPath === item.filePath)"
                  class="shrink-0 size-1.5 rounded-full bg-green-500"
                  title="Modified in PR"
                />
              </div>
              <div
                class="shrink-0 ml-3 text-[9px] text-muted-foreground"
              >
                {{ item.matches.length }}
              </div>
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
import { useCodeSearch } from './useCodeSearch'
import type { SearchResponse, CodeSearchState } from './searchTypes'
import type { FileDiff } from '@/types'
import DevIcon from '@/components/custom/DevIcon.vue'


interface Props {
  initialSearchKeyword?: string
  initialFilePattern?: string
  files?: FileDiff[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'file-selected': [data: {
    filePath: string
    fileContent: string | null
    fileDiff: FileDiff | null
    matchedLines: number[]
    searchKeyword: string
  }]
}>()

const { isPreparing, searchCode, getFileContent } = useCodeSearch()!

// State
const searchKeyword = ref(props.initialSearchKeyword || '')
const filePattern = ref(props.initialFilePattern || '')
const searchResults = ref<SearchResponse | null>(null)
const selectedFileIndex = ref<number>(-1)
const isSearching = ref(false)

// Computed
const selectedResult = computed(() => {
  if (selectedFileIndex.value >= 0 && searchResults.value) {
    return searchResults.value.results[selectedFileIndex.value] || null
  }
  return null
})

// Search logic
const performSearch = useDebounceFn(async () => {
  if (!searchKeyword.value || searchKeyword.value.length < 2) {
    searchResults.value = null
    selectedFileIndex.value = -1
    return
  }

  isSearching.value = true
  try {
    const results = await searchCode(
      searchKeyword.value,
      filePattern.value || undefined
    )

    searchResults.value = results

    selectedFileIndex.value = -1
  } catch (error) {
    console.error('Search failed:', error)
    searchResults.value = null
  } finally {
    isSearching.value = false
  }
}, 500)

watch([searchKeyword, filePattern], () => {
  void performSearch()
}, { immediate: true })

// Watch for initial props changes (when parent updates state)
watch(() => props.initialSearchKeyword, (newVal) => {
  if (newVal !== undefined && newVal !== searchKeyword.value) {
    searchKeyword.value = newVal
  }
}, { immediate: true })

watch(() => props.initialFilePattern, (newVal) => {
  if (newVal !== undefined && newVal !== filePattern.value) {
    filePattern.value = newVal
  }
}, { immediate: true })

// Watch for selection changes and emit to parent
watch(selectedResult, (result) => {
  if (!result) return

  const filePath = result.filePath
  const fileContent = getFileContent(filePath) || null
  const fileDiff = props.files?.find(f => f.newPath === filePath) || null
  const matchedLines = result.matches.map(m => m.line)

  emit('file-selected', {
    filePath,
    fileContent,
    fileDiff,
    matchedLines,
    searchKeyword: searchKeyword.value
  })
})

// Navigation
function navigateDown () {
  if (searchResults.value && selectedFileIndex.value < searchResults.value.results.length - 1) {
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

const keywordInputRef = ref<HTMLInputElement | null>(null)
const filePatternInputRef = ref<HTMLInputElement | null>(null)

// Expose state for parent to retrieve
defineExpose({
  getState: (): CodeSearchState => ({
    searchKeyword: searchKeyword.value,
    filePattern: filePattern.value
  }),
  clearState: () => {
    searchKeyword.value = ''
    filePattern.value = ''
    searchResults.value = null
    selectedFileIndex.value = -1
  },
  focus: () => {
    keywordInputRef.value?.focus()
  }
})

function focusSearchKeyword () {
  keywordInputRef.value?.focus()
}

function focusFilePattern () {
  filePatternInputRef.value?.focus()
}
</script>
