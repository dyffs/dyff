<template>
  <Card class="group relative hover:border-foreground/20 transition-colors py-4">
    <CardContent class="flex flex-col gap-3 px-4">
      <!-- Header: Avatar + Handle + Model -->
      <div class="flex items-start gap-3">
        <AgentAvatar
          :bot-uname="botUname"
          class-name="h-10 w-10 rounded-lg"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold text-sm truncate font-mono">
              {{ handle }}
            </h3>
            <Badge
              variant="secondary"
              :class="modelMeta.color"
              class="text-[10px] px-1.5 py-0 shrink-0"
            >
              {{ modelMeta.label }}
            </Badge>
          </div>
          <p
            v-tooltip="mode === 'preset' ? { content: systemPrompt, html: false } : undefined"
            class="text-xs text-muted-foreground mt-0.5 line-clamp-2"
            :class="{ 'cursor-help': mode === 'preset' }"
          >
            {{ description }}
          </p>
        </div>
      </div>

      <!-- Tags: Languages + Tools -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <Badge
          v-for="lang in languages"
          :key="lang"
          variant="outline"
          class="text-[10px] px-1.5 py-0"
        >
          {{ lang === 'all' ? 'All Languages' : lang }}
        </Badge>
        <div class="ml-auto flex items-center gap-1">
          <span
            v-for="tool in tools"
            :key="tool"
            v-tooltip="toolLabel(tool)"
            class="inline-flex items-center justify-center size-5 rounded bg-muted text-muted-foreground cursor-help"
          >
            <component
              :is="toolIcon(tool)"
              class="size-3"
            />
          </span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2 pt-1 border-t">
        <template v-if="mode === 'preset'">
          <Button
            variant="outline"
            size="xs"
            class="flex-1"
            @click="$emit('clone')"
          >
            <Copy class="size-3 mr-1" />
            Clone
          </Button>
        </template>
        <template v-else>
          <Button
            variant="outline"
            size="xs"
            class="flex-1"
            @click="$emit('edit')"
          >
            <Pencil class="size-3 mr-1" />
            Edit
          </Button>
          <Confirm
            title="Delete Agent"
            confirm-text="Delete"
            @confirm="$emit('delete')"
          >
            <template #trigger>
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6 text-muted-foreground hover:text-destructive"
              >
                <Trash2 class="size-3" />
              </Button>
            </template>
            <template #description>
              Are you sure you want to delete <strong>{{ handle }}</strong>?
            </template>
          </Confirm>
        </template>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import type { AgentTool, LLMModel } from './types'
import { ALL_MODELS, ALL_TOOLS } from './types'
import { computed } from 'vue'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, Pencil, Trash2, FileSearch, FileText, Search, FolderOpen, FileDiff } from 'lucide-vue-next'
import AgentAvatar from '@/components/custom/AgentAvatar.vue'
import Confirm from '@/components/custom/Confirm.vue'

const props = defineProps<{
  handle: string
  description: string
  botUname: string
  languages?: string[]
  tools: AgentTool[]
  model: LLMModel
  systemPrompt?: string
  mode: 'preset' | 'user'
}>()

defineEmits<{
  clone: []
  edit: []
  delete: []
}>()

const modelMeta = computed(() => {
  return ALL_MODELS.find(m => m.id === props.model) ?? { id: props.model, label: props.model, color: '' }
})

const TOOL_ICONS: Record<AgentTool, typeof FileSearch> = {
  diff_overview: FileSearch,
  read_file: FileText,
  search_code: Search,
  list_file: FolderOpen,
  diff_content: FileDiff,
}

function toolIcon (tool: AgentTool) {
  return TOOL_ICONS[tool] ?? FileText
}

function toolLabel (tool: AgentTool) {
  const meta = ALL_TOOLS.find(t => t.id === tool)
  return meta ? `${meta.label}: ${meta.description}` : tool
}
</script>
