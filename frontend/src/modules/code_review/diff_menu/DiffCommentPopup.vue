<template>
  <Teleport to="body">
    <div
      v-if="isCommentOpen"
      ref="popupRef"
      class="w-[420px] max-h-[550px] overflow-y-auto shadow-lg
        rounded-md bg-white border border-border z-50 flex flex-col gap-2 pt-4 pb-2"
      :style="popupStyle"
    >
      <div class="text-xs text-gray-800 font-medium px-4">
        {{ commentContextData?.filePath }}, line {{ commentContextData?.newLineEnd || commentContextData?.oldLineEnd }}
      </div>
      <CommentInput
        ref="commentInputRef"
        :username="currentUsername"
        :loading="isSubmitting"
        mode="diff"
        @reply="handleComment"
        @cancel="closeComment"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, useTemplateRef, nextTick, type CSSProperties } from 'vue'
import { computePosition, offset, flip, shift } from '@floating-ui/dom'
import { onClickOutside } from '@vueuse/core'

import CommentInput from '@/modules/comment/CommentInput.vue'
import { useContextMenu } from './useContextMenu'
import { usePullRequest } from '@/modules/pull_request/usePullRequest'

const contextMenu = useContextMenu()!
const { isCommentOpen, commentAnchorElement, commentContextData, closeComment } = contextMenu

const { currentUsername } = usePullRequest()!

const popupRef = ref<HTMLElement | null>(null)
const commentInputRef = useTemplateRef<InstanceType<typeof CommentInput>>('commentInputRef')
const isSubmitting = ref(false)

const popupStyle = ref<CSSProperties>({
  position: 'absolute',
  top: '0',
  left: '0',
})

watch([isCommentOpen, commentAnchorElement], async () => {
  if (isCommentOpen.value && commentAnchorElement.value && popupRef.value) {
    const { x, y } = await computePosition(commentAnchorElement.value, popupRef.value, {
      placement: 'right-start',
      middleware: [
        offset(8),
        flip(),
        shift({ padding: 8 })
      ]
    })

    popupStyle.value = {
      position: 'absolute',
      top: `${y}px`,
      left: `${x}px`,
    }

    nextTick(() => {
      commentInputRef.value?.focus()
    })
  }
}, { flush: 'post' })

onClickOutside(popupRef, () => {
  if (isCommentOpen.value) {
    closeComment()
  }
}, {
  ignore: [commentAnchorElement]
})

async function handleComment (content: string) {
  // TODO: implement
  console.log('handleComment', content)
}
</script>
