<template>
  <div class="flex flex-col gap-2 px-5 pt-1 pb-4 bg-primary-foreground">
    <div
      v-if="reviewWaiting"
      class="my-2 bg-neutral-50 p-3 rounded-md"
    >
      <div class="text-xs font-medium text-muted-foreground mb-3">
        AI is generating findings
      </div>
      <AgentProgressIndicator
        :progress="reviewProgress"
      />
    </div>
    <div
      v-if="reviewReady"
    >
      <MarkdownRenderer
        :content="reviewContent"
        :class="`
        prose max-w-none
        ${MARKDOWN_STYLES_CLASS}
      `"
      />
    </div>
    <div
      v-if="showGenerate"
      class="my-4"
    >
      <Button
        class="cursor-pointer"
        size="xs"
        variant="outline"

        @click="doSubmit"
      >
        <span>
          Generate Walkthrough & Findings
        </span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAIOverview } from './useAIOverview'
import { computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { get } from 'lodash-es'
import type { JobStatus } from '@/modules/job/types'
import MarkdownRenderer from './MarkdownRenderer'
import { MARKDOWN_STYLES_CLASS } from '../common/styles'
import AgentProgressIndicator from '@/modules/agent/AgentProgressIndicator.vue'
import { showGenerateButton } from './utils'
const { reviewJob, reviewProgress, submitBoth, fetchRuns } = useAIOverview()!

const reviewReady = computed(() => reviewJob.value?.status === 'completed')

const showGenerate = computed(() => showGenerateButton(reviewJob.value))

const waitingStatuses: JobStatus[] = ['pending', 'running']

const reviewWaiting = computed(() => reviewJob.value && waitingStatuses.includes(reviewJob.value.status))

const reviewContent = computed(() => get(reviewJob.value?.result, 'output', '') as string)

function doSubmit () {
  void submitBoth()
}

onMounted(() => {
  void fetchRuns()
})

</script>