<template>
  <div class="space-y-3">
    <template
      v-for="item in displayItems"
      :key="item.key"
    >
      <!-- Bubble: user or assistant text -->
      <div
        v-if="item.kind === 'bubble'"
        class="flex"
        :class="item.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          v-if="item.role === 'user'"
          class="max-w-[80%] rounded-lg px-3 py-2 whitespace-pre-wrap break-all bg-muted text-sm text-primary mb-3"
        >
          {{ item.text }}
        </div>
        <div
          v-else
          class="max-w-[90%] mb-4 bg-[#f9f7f5] px-3 py-2 rounded-lg"
        >
          <MarkdownRenderer
            :content="item.text"
            :class="`prose max-w-none ${MARKDOWN_STYLES_CHAT}`"
          />
        </div>
      </div>

      <!-- Aside group -->
      <div
        v-else
        class="mt-0 mb-2 max-w-[90%]"
      >
        <!-- Single aside: render directly, no collapse -->
        <div
          v-if="item.asides.length < 2"
          class="flex items-start gap-2 text-xs text-muted-foreground"
        >
          <span class="mt-1.5 inline-block w-1 h-1 rounded-full bg-muted-foreground/60 shrink-0" />
          <div class="flex-1 min-w-0">
            <span
              v-if="item.asides[0]!.label"
              class="font-medium"
            >{{ item.asides[0]!.label }}</span>
            <span
              v-if="item.asides[0]!.detail"
              class="ml-1 wrap-break-word"
            >{{ item.asides[0]!.detail }}</span>
          </div>
        </div>

        <!-- Multi aside: collapsible, collapsed by default -->
        <Collapsible v-else>
          <CollapsibleTrigger
            class="flex items-start gap-1 text-xs text-muted-foreground hover:text-foreground group w-full text-left"
          >
            <div class="flex-1 min-w-0 cursor-pointer">
              <span class="font-medium">{{ item.asides[0]!.label }}</span>
              <span
                v-if="item.asides[0]!.detail"
                class="ml-1 wrap-break-word"
              >{{ item.asides[0]!.detail }}</span>
              <span class="ml-1 text-muted-foreground/70">+{{ item.asides.length - 1 }} more</span>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div class="mt-1.5 space-y-1.5">
              <div
                v-for="(a, i) in item.asides.slice(1)"
                :key="i"
                class="flex items-start gap-2 text-xs text-muted-foreground pl-1"
              >
                <span class="mt-1.5 inline-block w-1 h-1 rounded-full bg-muted-foreground/60 shrink-0" />
                <div class="flex-1 min-w-0">
                  <span
                    v-if="a.label"
                    class="font-medium"
                  >{{ a.label }}</span>
                  <span
                    v-if="a.detail"
                    class="ml-1 wrap-break-word"
                  >{{ a.detail }}</span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { get } from 'lodash-es'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { SessionMessage, EnrichedPart } from './types'
import MarkdownRenderer from '@/modules/ai_overview/MarkdownRenderer'
import { MARKDOWN_STYLES_CHAT } from '@/modules/common/styles'

const props = defineProps<{
  messages: SessionMessage[]
}>()

interface Aside {
  label: string; detail?: string 
}
type DisplayItem =
  | { kind: 'bubble'; key: string; role: 'user' | 'assistant'; text: string }
  | { kind: 'aside-group'; key: string; asides: Aside[] }

function formatToolInput (toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'list_files':
    case 'read_file':
      return String(get(input, 'path', ''))
    case 'diff_overview':
      return ''
    case 'diff_content':
      return (get(input, 'file_paths', []) as string[]).join(', ')
    case 'search_code':
    case 'search_files':
      return String(get(input, 'pattern', ''))
    case 'add_finding':
    case 'update_summary':
    case 'review_notes':
      return ''
    default:
      return Object.values(input).map(v => String(v)).join(', ')
  }
}

function formatToolName (name: string): string {
  if (!name) return ''
  return name.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

function truncate (s: string, n = 160): string {
  const trimmed = s.trim()
  return trimmed.length > n ? trimmed.slice(0, n) + '…' : trimmed
}

function partsOf (m: SessionMessage): EnrichedPart[] {
  if (m.enriched && m.enriched.length > 0) return m.enriched
  if (m.role === 'user' || m.role === 'assistant') {
    return [{ type: 'text', text: m.raw }]
  }
  return [{ type: 'tool_result', tool_use_id: '', content: m.raw }]
}

function toAside (part: EnrichedPart): Aside | null {
  if (part.type === 'thinking') {
    return { label: 'Thinking', detail: truncate(part.thinking) }
  }
  if (part.type === 'tool_use') {
    const args = formatToolInput(part.name, part.input)
    return { label: formatToolName(part.name), detail: args ? `(${args})` : undefined }
  }
  if (part.type === 'tool_result') {
    return { label: 'Result', detail: truncate(part.content, 120) }
  }
  return null
}

const displayItems = computed<DisplayItem[]>(() => {
  const items: DisplayItem[] = []
  let currentGroup: { key: string; asides: Aside[] } | null = null

  const flushGroup = () => {
    if (currentGroup && currentGroup.asides.length > 0) {
      items.push({ kind: 'aside-group', key: currentGroup.key, asides: currentGroup.asides })
    }
    currentGroup = null
  }

  for (const msg of props.messages) {
    const parts = partsOf(msg)
    parts.forEach((part, idx) => {
      const key = `${msg.id}:${idx}`
      if (part.type === 'text') {
        const text = part.text.trim()
        if (!text) return
        flushGroup()
        const role = msg.role === 'user' ? 'user' : 'assistant'
        items.push({ kind: 'bubble', key, role, text: part.text })
      } else {
        const aside = toAside(part)
        if (!aside) return
        if (!currentGroup) currentGroup = { key, asides: [] }
        currentGroup.asides.push(aside)
      }
    })
  }
  flushGroup()
  return items
})
</script>
