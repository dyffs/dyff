<template>
  <div class="px-2">
    <!-- Header with Avatar -->
    <div class="flex gap-2 mb-1 items-start">
      <Textarea
        ref="textareaRef"
        v-model="textContent"
        placeholder="Write your comment here..."
        class="min-h-[18px] bg-white border-border rounded focus-visible:ring-0"
        :disabled="isReplying"
      />
    </div>

    <!-- Action Buttons -->
    <div class="flex justify-end items-center gap-2 pt-2">
      <Button
        v-show="hasContent && !isReplying"
        variant="ghost"
        size="xs"
        @click="handleCancel"
      >
        Cancel
      </Button>

      <div>
        <Button
          size="xs"
          :disabled="!hasContent || loading"
          @click="handleReply"
        >
          <Spinner
            v-if="loading"
            size="xs"
          />
          <span v-else>
            Comment
            <span class="text-xs text-muted-foreground">
              ({{ osShortcut('cmd', 'Enter') }})
            </span>
          </span>
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import type { AppComment } from '@/types'
import { Spinner } from '@/components/ui/spinner'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { osShortcut } from '@/lib/utils'
import { onKeyStroke } from '@vueuse/core'

interface Props {
  mode: 'reply-only' | 'diff'
  isReplying?: boolean
  existingComment?: AppComment
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  existingComment: undefined,
  isReplying: false,
})

const emit = defineEmits<{
  cancel: []
  startReview: [content: string]
  reply: [content: string]
  confirm: [content: string]
}>()

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

const handleReply = () => {
  const content = getEditorContent()
  emit('reply', content)
}

function clear () {
  textContent.value = ''
}

function focus () {
  textareaRef.value?.focus()
}

onKeyStroke(['Enter'], (e) => {
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault()
    handleReply()
  }
})

defineExpose({ clear, focus })
</script>
