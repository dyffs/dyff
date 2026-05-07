<template>
  <div
    class="pr-file-entry flex items-top gap-2 cursor-pointer hover:bg-secondary-foreground rounded-md px-2 py-2"
    @click="navigateToFile"
  >
    <div class="mt-0.5">
      <input
        v-model="reviewed"
        type="checkbox"
        class="cursor-normal"
        @click.stop
      >
    </div>
    <div
      class="flex flex-1 flex-col gap-0"
    >
      <div class="flex items-start gap-2 text-[12px]">
        <span class="text-info font-mono break-all font-medium">
          {{ path }}
        </span>
        <span
          class="text-secondary text-[10px] px-1.5 py-0 mt-0.5 rounded-full whitespace-nowrap "
          :style="magnitudeStyle"
        >
          {{ magnitude }}
        </span>
      </div>
      <div class="flex items-center gap-2 font-medium">
        <span class="text-[12px] text-secondary">
          {{ role }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCodeReview } from '@/modules/code_review/useCodeReview'
import { useDiffNavigate } from '@/modules/code_review/useDiffNavigate'

const { isFileReviewed, toggleFileReviewed, getFileByPath } = useCodeReview()!
const { handleSelectFile } = useDiffNavigate()!

const props = defineProps<{
  path?: string
  magnitude?: string
  role?: string
}>()

const reviewed = computed({
  get: () => props.path ? isFileReviewed(props.path) : false,
  set: () => {
    if (props.path) {
      toggleFileReviewed(props.path)
    }
  },
})

function navigateToFile () {
  if (!props.path) return
  const file = getFileByPath(props.path)
  if (!file) return
  void handleSelectFile({ fileId: file.id, options: { expanded: true } })
}

const magnitudeStyle = computed(() => {
  switch (props.magnitude) {
    case 'new file':
      return 'background:#E6F1FB; color:#0C447C'
    case 'deleted':
      return 'background:#FAEEDA; color:#633806'
    case 'significant change':
      return 'background:#FAEEDA; color:#633806'
    case 'minor edit':
      return 'background:#EAF3DE; color:#27500A'
    case 'config/wiring':
    default:
      return 'background:#F1EFE8; color:#444441;'
  }
})

</script>
