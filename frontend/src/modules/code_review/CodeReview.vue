<template>
  <div class="flex flex-col bg-background h-full overflow-hidden">
    <!-- Header -->
    <CodeReviewHeader
      :pr="pr"
      :owner="owner"
      :repo="repo"
      :pr-number="parseInt(route.params.pr_number as string)"
      :total-additions="totalAdditions"
      :total-deletions="totalDeletions"
      :reviewed-count="reviewedCount"
      :files-length="files.length"
      :file-tree="fileTree"
      :is-fetching-diff="isFetchingDiff"
      :selected-file-id="selectedFileId"
      @select-file="handleSelectFile"
      @toggle-folder="handleToggleFolder"
    />

    <!-- Toolbar teleport -->
    <Teleport
      v-if="pr"
      to="#reviewed-info"
    >
      <div class="flex items-center justify-end shrink-0 gap-3">
        <div class="text-xs text-muted-foreground">
          {{ reviewedCount }}/{{ files.length }} reviewed
        </div>
        <Select
          :model-value="diffMode"
          @update:model-value="diffMode = $event as 'inline' | 'split'"
        >
          <SelectTrigger
            class="text-xs"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              value="inline"
              class="text-xs"
            >
              Inline
            </SelectItem>
            <SelectItem
              value="split"
              class="text-xs"
            >
              Split
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Teleport>

    <!-- Main Layout: Sidebar + Diff -->
    <div class="flex-1 overflow-hidden ">
      <ResizablePanelGroup direction="horizontal">
        <!-- Sidebar -->
        <ResizablePanel
          :default-size="30"
          :min-size="15"
          :max-size="50"
        >
          <div class="h-full w-full border-l overflow-y-auto overflow-x-hidden p-4 bg-surface-3">
            <Tabs
              v-model="sidebarTab"
              class="flex-1 h-full flex flex-col overflow-x-hidden overflow-y-auto gap-0 bg-white rounded-md border"
              :unmount-on-hide="false"
            >
              <TabsList class="w-full bg-transparent h-11 rounded-none border-b">
                <TabsTrigger
                  value="github"
                  class="text-xs hover:cursor-pointer shadow-none data-[state=active]:border-neutral-200"
                >
                  Github
                </TabsTrigger>
                <TabsTrigger
                  value="ai_overview"
                  class="text-xs hover:cursor-pointer shadow-none data-[state=active]:border-neutral-200"
                >
                  Walkthrough
                </TabsTrigger>
                <TabsTrigger
                  value="ai_review"
                  class="text-xs hover:cursor-pointer shadow-none data-[state=active]:border-neutral-200"
                >
                  Findings
                </TabsTrigger>
                <TabsTrigger
                  value="ai_chat"
                  class="text-xs hover:cursor-pointer shadow-none data-[state=active]:border-neutral-200"
                >
                  Chat
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="ai_overview"
                class="flex-1 m-0 overflow-y-auto overflow-x-hidden"
              >
                <AIOverview v-if="pr" />
              </TabsContent>

              <TabsContent
                value="ai_review"
                class="flex-1 m-0 overflow-y-auto overflow-x-hidden"
              >
                <AIReview v-if="pr" />
              </TabsContent>

              <TabsContent
                value="ai_chat"
                class="flex-1 m-0 overflow-hidden"
              >
                <AIChat v-if="pr" />
              </TabsContent>

              <TabsContent
                value="github"
                class="flex-1 m-0 overflow-y-auto overflow-x-hidden"
              >
                <PrDescriptionAndComments
                  v-if="pr"
                  :pr="pr"
                  @select-file="handleSelectFile"
                />
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle with-handle />

        <!-- Diff Content -->
        <ResizablePanel :default-size="70">
          <DiffContent
            :files="files"
            :is-fetching-diff="isFetchingDiff"
            :is-file-reviewed="codeReview.isFileReviewed"
            :diff-mode="diffMode"
            @toggle-file-expanded="toggleFileExpanded"
            @toggle-file-reviewed="toggleFileReviewed"
            @select-file="handleSelectFile"
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>

    <CodeBookmark @select-file="handleSelectFile" />

    <FloatingSearch
      v-if="pr && codeSearchCtrl.isOpen.value"
      ref="floatingSearchRef"
      :repo-meta="{
        owner,
        repo,
        commitSha: pr.head_commit_sha,
      }"
      :files="files"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { onKeyStroke, useLocalStorage } from '@vueuse/core'

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { usePullRequest } from '@/modules/pull_request/usePullRequest'
import { parseDiff, buildFileTree } from '@/utils/diffParser'
import { highlightLine } from '@/utils/syntaxHighlighter'
import { useProvideCodeSearch, useCodeSearch } from '@/modules/search/useCodeSearch'
import { useProvideCodeReview } from '@/modules/code_review/useCodeReview'
import { useProvideCommentConfig } from '@/modules/comment/useCommentConfig'
import { useProvideCodeBookmark } from '@/modules/bookmark/useCodeBookmark'
import { useProvideDiffNavigate } from '@/modules/code_review/useDiffNavigate'
import { useProvideVirtualDiffScroller } from '@/modules/code_review/diff/useVirtualDiffScroller'
import { useProvideCommentSystem } from '@/modules/comment/useCommentSystem'
import { useProvideAIOverview } from '@/modules/ai_overview/useAIOverview'
import { useProvideChat } from '@/modules/agent/useChat'

import type { FileTreeNode as FileTreeNodeType, SerializedPullRequest } from '@/types'

import CodeReviewHeader from './CodeReviewHeader.vue'
import DiffContent from './DiffContent.vue'
import PrDescriptionAndComments from './PrDescriptionAndComments.vue'
import FloatingSearch from '@/modules/search/FloatingSearch.vue'
import AIOverview from '@/modules/ai_overview/AIOverview.vue'
import AIReview from '@/modules/ai_overview/AIReview.vue'
import AIChat from '@/modules/agent/AIChat.vue'
import CodeBookmark from '@/modules/bookmark/CodeBookmark.vue'

// Provide code review state
const codeReview = useProvideCodeReview()
useProvideCodeBookmark()
const { pollOnce } = useProvideCommentSystem()

const route = useRoute()
const pullRequest = usePullRequest()
if (!pullRequest) throw new Error('CodeReview must be used inside a PullRequest provider')
const { fetchPullRequestDiff, fetchPrDetails, init, pullRequests } = pullRequest
useProvideCodeSearch()
const codeSearchCtrl = useCodeSearch()!

const owner = route.params.owner as string
const repo = route.params.repo as string

const diff = ref('')
const files = codeReview.files
const pr = codeReview.pr

const fileTree = ref<FileTreeNodeType[]>([])
const isFetchingDiff = ref(false)
const diffMode = useLocalStorage<'inline' | 'split'>('code-review-diff-mode', 'inline')

const scroller = useProvideVirtualDiffScroller()
const { selectedFileId, handleSelectFile } = useProvideDiffNavigate(expandFile, scroller.scrollController)
const sidebarTab = ref<'ai_overview' | 'ai_review' | 'ai_chat' | 'github'>('github')
const floatingSearchRef = ref<InstanceType<typeof FloatingSearch> | null>(null)

// Provide comment config and comments state
const prId = computed(() => pr.value?.id ?? null)

useProvideCommentConfig(prId)

useProvideAIOverview(pr)
useProvideChat(pr)

const totalAdditions = computed(() => files.value.reduce((sum, f) => sum + f.additions, 0))
const totalDeletions = computed(() => files.value.reduce((sum, f) => sum + f.deletions, 0))
const reviewedCount = computed(() => codeReview.getReviewedCount())

async function highlightDiffLines () {
  for (const file of files.value) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'hunk' && line.content) {
          try {
            line.highlightedContent = await highlightLine(line.content, file.newPath)
          } catch (error) {
            console.error('Failed to highlight line:', error)
            line.highlightedContent = line.content
          }
        }
      }
    }
  }
}

onMounted(async () => {
  isFetchingDiff.value = true
  if (pullRequests.value.length === 0) {
    await init(owner, repo)
  }


  const prNumber = parseInt(route.params.pr_number as string)
  pr.value = await fetchPrDetails(prNumber)

  if (!pr.value) {
    toast.error('Pull request not found')
    isFetchingDiff.value = false
    return
  }

  // Load file reviews from backend
  await codeReview.loadFileReviews(pr.value.id)

  diff.value = await fetchPullRequestDiff(pr.value.id) ?? ''

  if (diff.value) {
    files.value = parseDiff(diff.value)
    fileTree.value = buildFileTree(files.value)

    // Sync file reviews (detect outdated reviews)
    await codeReview.syncFileReviews(pr.value.id)

    // Auto-collapse reviewed files
    for (const file of files.value) {
      if (codeReview.isFileReviewed(file.newPath)) {
        file.isExpanded = false
      }
    }

    await highlightDiffLines()
    void pollOnce(pr.value.id)
  }

  isFetchingDiff.value = false
})

// Focus Mini IDE search input when the floating window opens
watch(() => codeSearchCtrl.isOpen.value, (open) => {
  if (open) {
    setTimeout(() => {
      floatingSearchRef.value?.focus()
    }, 50)
  }
})

// Keyboard shortcut to open Mini IDE
onKeyStroke(['k'], (e) => {
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault()
    codeSearchCtrl.openMiniIDE()
  }
})

function expandFile (fileId: string) {
  const file = files.value.find(f => f.id === fileId)
  if (file) {
    file.isExpanded = true
  }
}

function handleToggleFolder (path: string) {
  const toggleNode = (nodes: FileTreeNodeType[]): boolean => {
    for (const node of nodes) {
      if (node.path === path) {
        node.isExpanded = !node.isExpanded
        return true
      }
      if (node.children && toggleNode(node.children)) {
        return true
      }
    }
    return false
  }
  toggleNode(fileTree.value)
}

async function toggleFileReviewed (fileId: string) {
  if (!pr.value) return

  const file = files.value.find(f => f.id === fileId)
  if (file) {
    await codeReview.toggleFileReviewed(file.newPath)
  }
}

function toggleFileExpanded (fileId: string) {
  const file = files.value.find(f => f.id === fileId)
  if (file) {
    file.isExpanded = !file.isExpanded
  }
}

</script>
