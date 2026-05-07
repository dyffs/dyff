<template>
  <div
    v-if="searchReady"
    class="h-full flex items-start gap-1 overflow-y-auto"
  >
    <!-- Search Section -->
    <div class="shrink-0 px-3 w-[420px] border-r h-full">
      <Tabs
        v-model="activeTab"
        :unmount-on-hide="false"
      >
        <TabsList class="w-full h-10 bg-white">
          <TabsTrigger
            value="code"
            class="flex-1 text-xs"
          >
            Code Search
          </TabsTrigger>
          <TabsTrigger
            value="file"
            class="flex-1 text-xs"
          >
            File Search
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="code"
          class="m-0 mt-2"
        >
          <CodeSearchTab
            ref="codeSearchTabRef"
            :initial-search-keyword="searchState.codeSearch?.searchKeyword"
            :initial-file-pattern="searchState.codeSearch?.filePattern"
            :files="files"
            @file-selected="handleCodeSearchFileSelected"
          />
        </TabsContent>

        <TabsContent
          value="file"
          class="m-0 mt-2"
        >
          <FileSearchTab
            ref="fileSearchTabRef"
            :initial-file-name-query="searchState.fileSearch?.fileNameQuery"
            :files="files"
            @file-selected="handleFileSelected"
          />
        </TabsContent>
      </Tabs>
    </div>

    <!-- File Preview -->
    <div class="flex-1 h-full overflow-y-auto">
      <FilePreview
        :selected-file-path="selectedFileData.filePath"
        :file-content="selectedFileData.fileContent"
        :file-diff="selectedFileData.fileDiff"
        :matched-lines="selectedFileData.matchedLines"
        :search-keyword="selectedFileData.searchKeyword"
      />
    </div>
  </div>
  <div
    v-else
    class="flex items-center gap-1 justify-center h-full"
  >
    <Spinner
      class="size-3"
    />
    <span class="text-sm text-muted-foreground">
      Preparing search data...
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

import { useCodeSearch } from './useCodeSearch'
import FileSearchTab from './FileSearchTab.vue'
import CodeSearchTab from './CodeSearchTab.vue'
import FilePreview from './FilePreview.vue'
import { Spinner } from '@/components/ui/spinner'
import type { FileDiff } from '@/types'

interface Props {
  repoMeta: { owner: string; repo: string; commitSha: string } | null
  files?: FileDiff[]
}

const props = defineProps<Props>()

const codeSearch = useCodeSearch()!
const { checkReady, isPreparing, searchState, selectedFileData } = codeSearch

// Tab State — synced with central searchState
const activeTab = ref<'file' | 'code'>(searchState.value.activeTab)

const searchReady = computed(() => {
  return props.repoMeta && !isPreparing.value
})

watch(() => searchState.value.activeTab, (newTab) => {
  activeTab.value = newTab
})

// Load repo data when repoMeta becomes available
watch(() => props.repoMeta, async (meta) => {
  if (meta) {
    await checkReady(meta)
  }
}, { immediate: true })

// Tab refs
const fileSearchTabRef = ref<InstanceType<typeof FileSearchTab> | null>(null)
const codeSearchTabRef = ref<InstanceType<typeof CodeSearchTab> | null>(null)

function handleFileSelected (data: {
  filePath: string
  fileContent: string | null
  fileDiff: FileDiff | null
}) {
  selectedFileData.value = {
    filePath: data.filePath,
    fileContent: data.fileContent,
    fileDiff: data.fileDiff,
    matchedLines: [],
    searchKeyword: undefined
  }
  void syncStateBack()
}

function handleCodeSearchFileSelected (data: {
  filePath: string
  fileContent: string | null
  fileDiff: FileDiff | null
  matchedLines: number[]
  searchKeyword: string
}) {
  selectedFileData.value = {
    filePath: data.filePath,
    fileContent: data.fileContent,
    fileDiff: data.fileDiff,
    matchedLines: data.matchedLines,
    searchKeyword: data.searchKeyword
  }
  void syncStateBack()
}

const syncStateBack = useDebounceFn(() => {
  searchState.value = {
    activeTab: activeTab.value,
    fileSearch: fileSearchTabRef.value?.getState() || { fileNameQuery: '' },
    codeSearch: codeSearchTabRef.value?.getState() || { searchKeyword: '', filePattern: '' }
  }
}, 500)

function focus () {
  if (isPreparing.value) return
  setTimeout(() => {
    if (activeTab.value === 'file') {
      fileSearchTabRef.value?.focus()
    } else {
      codeSearchTabRef.value?.focus()
    }
  }, 100)
}

defineExpose({ focus })
</script>
