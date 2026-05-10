<template>
  <div class="px-4">
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
      <div>
        <Button
          size="xs"
          :disabled="!hasContent || loading"
          @click="handleReply"
        >
          <Spinner
            v-if="loading"
            class="size-3"
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
