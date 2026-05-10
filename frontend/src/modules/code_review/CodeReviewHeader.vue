<template>
  <div class="border-b px-4 pb-1 pt-2 flex flex-col items-start gap-3 justify-between shrink-0">
    <div
      v-if="pr"
      class="flex flex-col gap-1.5 w-full"
    >
      <Teleport to="#header-teleport">
        <div class="flex items-center gap-2 text-sm">
          <router-link
            :to="`/repositories/${owner}/${repo}/pulls`"
            class="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft class="size-3" />
            <span>
              {{ owner }}/{{ repo }}
            </span>
          </router-link>
        </div>
      </Teleport>

      <div class="flex items-start gap-2">
        <div class="flex-1 flex gap-2">
          <div class="flex flex-col items-start gap-1">
            <h1 class="font-medium flex items-center gap-2 text-lg">
              <span class="text-foreground">{{ pr?.title }}</span>
              <span class="text-muted-foreground">
                #{{ prNumber }}
              </span>
            </h1>
            <div class="flex items-center gap-2">
              <GithubAvatar
                :username="pr.author_github_username!"
                class-name="h-4 w-4 ring-1 ring-neutral-300"
              />
              <span class="text-xs text-muted-foreground">{{ pr.author_github_username }}</span>
              <Separator
                orientation="vertical"
                class="data-[orientation=vertical]:h-4"
              />
              <span class="flex items-center gap-1 text-xs text-muted-foreground">
                {{ pr.head_branch }}
                <span class="mr-2">({{ pr.head_commit_sha.substring(0, 7) }})</span> → <span class="ml-2">{{ pr.base_branch }}</span>
              </span>
              <div class="mb-1">
                <PRStatus
                  :status="pr.github_status"
                  :merged="pr.github_merged_at !== null"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 flex flex-col">
          <div class="flex flex-1 justify-end items-center gap-3 text-xs text-muted-foreground">
            <span>
              <span class="text-green-600 dark:text-green-400">+{{ totalAdditions }}</span>
              <span class="mx-1">/</span>
              <span class="text-red-600 dark:text-red-400">-{{ totalDeletions }}</span>
            </span>
            <Separator
              orientation="vertical"
              class="data-[orientation=vertical]:h-4"
            />
            <a
              :href="`https://github.com/${owner}/${repo}/pull/${prNumber}`"
              target="_blank"
              class="text-muted-foreground hover:text-blue-500 flex items-center gap-1"
            >
              <img
                src="/assets/github-logo-black.svg"
                alt="GitHub"
                class="h-3 w-3"
              >
              <span class="text-xs">
                View on GitHub
              </span>
            </a>
            <Separator
              orientation="vertical"
              class="data-[orientation=vertical]:h-4"
            />
            <FileTreePopup
              :file-tree="fileTree"
              :is-fetching-diff="isFetchingDiff"
              :selected-file-id="selectedFileId"
              :files-length="filesLength"
              @select-file="$emit('select-file', $event)"
              @toggle-folder="$emit('toggle-folder', $event)"
            />
            <Separator
              orientation="vertical"
              class="data-[orientation=vertical]:h-4"
            />
            <div class="flex items-center justify-end">
              <div id="reviewed-info" />
            </div>
          </div>
          <div class="flex items-center justify-end mt-1">
            <Button
              variant="ghost"
              size="sm"
              class="flex items-center justify-end pr-3"
              @click="codeSearchCtrl.openMiniIDE()"
            >
              <span class="text-xs text-muted-foreground">
                Code Search
              </span>
              <span class="ml-1.5 text-xs text-muted-foreground">
                ({{ osShortcut('cmd', 'K') }})
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import type { SerializedPullRequest, FileTreeNode as FileTreeNodeType, DiffNavigateEvent } from '@/types'
import GithubAvatar from '@/components/custom/GithubAvatar.vue'
import PRStatus from '@/components/custom/PRStatus.vue'
import { Separator } from '@/components/ui/separator'
import FileTreePopup from './FileTreePopup.vue'
import { osShortcut } from '@/lib/utils'
import Button from '@/components/ui/button/Button.vue'
import { useCodeSearch } from '@/modules/search/useCodeSearch'

const codeSearchCtrl = useCodeSearch()!

defineProps<{
  pr: SerializedPullRequest | null
  owner: string
  repo: string
  prNumber: number
  totalAdditions: number
  totalDeletions: number
  reviewedCount: number
  filesLength: number
  fileTree: FileTreeNodeType[]
  isFetchingDiff: boolean
  selectedFileId: string | null
}>()

defineEmits<{
  'select-file': [event: DiffNavigateEvent]
  'toggle-folder': [path: string]
}>()
</script>
