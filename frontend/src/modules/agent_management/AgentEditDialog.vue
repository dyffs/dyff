<template>
  <Dialog
    :open="open"
    @update:open="$emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? 'Edit Agent' : 'Create Agent' }}</DialogTitle>
        <DialogDescription>
          Configure your review agent's behavior and capabilities.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-2">
        <!-- Handle + Avatar -->
        <div class="flex items-end gap-3">
          <AgentAvatar
            :bot-uname="form.botUname"
            class-name="h-12 w-12 rounded-lg"
          />
          <div class="flex-1">
            <Label for="agent-handle">Handle</Label>
            <Input
              id="agent-handle"
              v-model="form.handle"
              placeholder="@review_bot"
              class="mt-1 font-mono"
              @input="handleHandleChange"
            />
            <p class="text-[11px] text-muted-foreground mt-0.5">
              Use this handle to summon the agent in chat
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 shrink-0"
            title="Randomize avatar"
            @click="randomizeAvatar"
          >
            <RefreshCw class="size-3.5" />
          </Button>
        </div>

        <!-- Name -->
        <div>
          <Label for="agent-name">Display Name</Label>
          <Input
            id="agent-name"
            v-model="form.name"
            placeholder="My Review Agent"
            class="mt-1"
          />
        </div>

        <!-- Description -->
        <div>
          <Label for="agent-desc">Description</Label>
          <Input
            id="agent-desc"
            v-model="form.description"
            placeholder="What does this agent focus on?"
            class="mt-1"
          />
        </div>

        <!-- Model -->
        <div>
          <Label>Model</Label>
          <div class="flex gap-2 mt-1">
            <Button
              v-for="m in ALL_MODELS"
              :key="m.id"
              size="xs"
              :variant="form.model === m.id ? 'default' : 'outline'"
              @click="form.model = m.id"
            >
              {{ m.label }}
            </Button>
          </div>
        </div>

        <!-- Tools -->
        <div>
          <Label>Tools</Label>
          <div class="grid grid-cols-1 gap-1.5 mt-1">
            <label
              v-for="tool in ALL_TOOLS"
              :key="tool.id"
              class="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors"
              :class="{ 'border-foreground/20 bg-accent/30': form.tools.includes(tool.id) }"
            >
              <Checkbox
                :checked="form.tools.includes(tool.id)"
                @update:checked="toggleTool(tool.id)"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium">
                  {{ tool.label }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ tool.description }}
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- System Prompt -->
        <div>
          <Label>System Prompt</Label>
          <div class="mt-1 border rounded-md">
            <EditorContent
              v-if="editor"
              :editor="editor"
              class="prose prose-sm px-3 py-2 focus:outline-none max-w-none
              prose-p:my-1
              prose-p:text-sm
              selection:bg-[#4389d884]
              min-h-[120px] max-h-[200px] overflow-y-auto"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="$emit('update:open', false)"
        >
          Cancel
        </Button>
        <Button
          :disabled="!isValid"
          @click="handleSave"
        >
          {{ isEdit ? 'Save Changes' : 'Create Agent' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import type { AgentTool, LLMModel, UserAgent } from './types'
import { ALL_TOOLS, ALL_MODELS } from './types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RefreshCw } from 'lucide-vue-next'
import AgentAvatar from '@/components/custom/AgentAvatar.vue'

const props = defineProps<{
  open: boolean
  agent?: UserAgent | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'save': [agent: UserAgent]
}>()

const isEdit = computed(() => !!props.agent)

const form = reactive<{
  handle: string
  name: string
  description: string
  botUname: string
  model: LLMModel
  tools: AgentTool[]
}>({
  handle: '',
  name: '',
  description: '',
  botUname: '',
  model: 'claude',
  tools: ALL_TOOLS.map(t => t.id),
})

const editor = useEditor({
  extensions: [StarterKit],
  content: '',
  editorProps: {
    attributes: {
      class: 'focus:outline-none',
    },
  },
})

// Reset form when dialog opens or agent changes
watch(() => [props.open, props.agent] as const, ([open, agent]) => {
  if (!open) return
  if (agent) {
    form.handle = agent.handle
    form.name = agent.name
    form.description = agent.description
    form.botUname = agent.botUname
    form.model = agent.model
    form.tools = [...agent.tools]
    editor.value?.commands.setContent(agent.systemPrompt || '')
  } else {
    form.handle = '@'
    form.name = ''
    form.description = ''
    form.botUname = `agent-${Date.now()}`
    form.model = 'claude'
    form.tools = ALL_TOOLS.map(t => t.id)
    editor.value?.commands.setContent('')
  }
}, { immediate: true })

const isValid = computed(() => form.handle.trim().length > 1 && form.tools.length > 0)

let avatarManuallySet = false

function handleHandleChange () {
  // Ensure handle starts with @
  if (!form.handle.startsWith('@')) {
    form.handle = '@' + form.handle
  }
  // Auto-derive avatar from handle
  if (!avatarManuallySet) {
    const seed = form.handle.replace(/^@/, '') || `agent-${Date.now()}`
    form.botUname = seed.toLowerCase().replace(/\s+/g, '-')
  }
}

function randomizeAvatar () {
  avatarManuallySet = true
  form.botUname = `agent-${Math.random().toString(36).slice(2, 8)}`
}

function toggleTool (toolId: AgentTool) {
  const idx = form.tools.indexOf(toolId)
  if (idx >= 0) {
    form.tools.splice(idx, 1)
  } else {
    form.tools.push(toolId)
  }
}

function handleSave () {
  const agent: UserAgent = {
    id: props.agent?.id || `agent-${Date.now()}`,
    handle: form.handle.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    botUname: form.botUname,
    model: form.model,
    tools: [...form.tools],
    systemPrompt: editor.value?.getText() || '',
    clonedFromPresetId: props.agent?.clonedFromPresetId,
  }
  emit('save', agent)
  emit('update:open', false)
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<style scoped>
:deep(.ProseMirror) {
  min-height: 120px;
}

:deep(.ProseMirror:focus) {
  outline: none;
}

:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: 'Define how this agent reviews code...';
  float: left;
  color: hsl(var(--muted-foreground));
  pointer-events: none;
  height: 0;
}
</style>
