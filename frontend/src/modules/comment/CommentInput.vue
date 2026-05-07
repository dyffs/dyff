<template>
  <div class="overflow-hidden px-2">
    <!-- Header with Avatar -->
    <div class="flex gap-2 mb-1 items-start">
      <GithubAvatar
        :username="username || 'You'"
        class="h-5 w-5 ring-1 ring-neutral-300 mt-2"
      />
      <!-- Editor -->
      <div class="min-h-[18px] bg-white border rounded flex-1">
        <EditorContent
          v-if="editor"
          :editor="editor"
          class="prose prose-sm px-2 focus:outline-none max-w-none
          prose-p:my-2
          prose-p:text-sm
          prose-ul:my-2
          prose-li:my-0
          selection:bg-[#4389d884]"
        />
      </div>
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
import { computed, onBeforeUnmount, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Button } from '@/components/ui/button'
import type { AppComment } from '@/types'
import GithubAvatar from '@/components/custom/GithubAvatar.vue'
import { Spinner } from '@/components/ui/spinner'

interface Props {
  username: string
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

// Initialize editor with existing content if available
const initialContent = computed(() => {
  if (props.existingComment?.content?.body) {
    return props.existingComment.content.body
  }
  return ''
})

const editor = useEditor({
  extensions: [StarterKit],
  content: initialContent.value,
  editorProps: {
    attributes: {
      // class: 'focus:outline-none min-h-[40px]',
    },
  },
})

// Check if editor has content
const hasContent = computed(() => {
  if (!editor.value) return false
  const text = editor.value.getText().trim()
  return text.length > 0
})

// Watch for external changes to existing comment
watch(
  () => props.existingComment?.content?.body,
  (newContent) => {
    if (editor.value && newContent !== undefined) {
      const currentText = editor.value.getText()
      if (currentText !== newContent) {
        editor.value.commands.setContent(newContent || '')
      }
    }
  }
)

// Action handlers
const getEditorContent = (): string => {
  return editor.value?.getText() || ''
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
  editor.value?.commands.clearContent()
}

function focus () {
  editor.value?.commands.focus()
}

defineExpose({ clear, focus })

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style scoped>
:deep(.ProseMirror) {
  min-height: 18px;
}

:deep(.ProseMirror:focus) {
  outline: none;
}

:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: 'Write your comment here...';
  float: left;
  color: hsl(var(--muted-foreground));
  pointer-events: none;
  height: 0;
}
</style>
