<template>
  <div class="overflow-hidden px-2">
    <!-- Header with Avatar -->
    <div class="flex gap-2 mb-1 items-start">
      <GithubAvatar
        v-if="username"
        :username="username"
        class="h-5 w-5 ring-1 ring-neutral-300 mt-2"
      />
      <span v-else>You</span>
      <!-- Editor -->
      <textarea
        ref="textareaRef"
        v-model="textContent"
        placeholder="Write your comment here..."
        class="min-h-[18px] bg-white border rounded flex-1 resize-none
          px-2 py-1 text-sm focus:outline-none
          selection:bg-[#4389d884]"
      />
    </div>

    

    <!-- Action Buttons -->
    <div class="flex justify-end items-center gap-2 py-2">
      <Button
        v-show="hasContent"
        variant="ghost"
        size="xs"
        @click="handleCancel"
      >
        Cancel
      </Button>

      <template v-if="isEditMode">
        <Button
          size="xs"
          :disabled="!hasContent"
          @click="handleConfirm"
        >
          Confirm
        </Button>
      </template>

      <template v-else>
        <Button
          v-if="mode === 'review' || mode === 'diff'"
          variant="secondary"
          size="xs"
          :disabled="!hasContent"
          @click="handleStartReview"
        >
          Start a review
        </Button>
        <Button
          size="xs"
          :disabled="!hasContent || loading"
          @click="handleReply"
        >
          <Spinner
            v-if="loading"
            size="xs"
          />
          <span v-else>Comment</span>
        </Button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import type { AppComment } from '@/types'
import GithubAvatar from '@/components/custom/GithubAvatar.vue'
import { Spinner } from '@/components/ui/spinner'

interface Props {
  username?: string | null
  avatarUrl?: string
  mode?: 'review' | 'reply-only' | 'diff'
  existingComment?: AppComment
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  avatarUrl: undefined,
  mode: 'review',
  loading: false,
  existingComment: undefined,
})

const emit = defineEmits<{
  cancel: []
  startReview: [content: string]
  reply: [content: string]
  confirm: [content: string]
}>()

// Determine if we're in edit mode
const isEditMode = computed(() => !!props.existingComment)

const textContent = ref(initialText())
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function initialText (): string {
  return props.existingComment?.content?.body || ''
}

// Check if textarea has content
const hasContent = computed(() => textContent.value.trim().length > 0)

// Watch for external changes to existing comment
watch(
  () => props.existingComment?.content?.body,
  (newContent) => {
    if (newContent !== undefined && textContent.value !== newContent) {
      textContent.value = newContent || ''
    }
  }
)

// Action handlers
const getEditorContent = (): string => {
  return textContent.value
}

const handleCancel = () => {
  clear()
  emit('cancel')
}

const handleStartReview = () => {
  const content = getEditorContent()
  emit('startReview', content)
}

const handleReply = () => {
  const content = getEditorContent()
  emit('reply', content)
}

const handleConfirm = () => {
  const content = getEditorContent()
  emit('confirm', content)
}

function clear () {
  textContent.value = ''
}

function focus () {
  textareaRef.value?.focus()
}

defineExpose({ clear, focus })
</script>



