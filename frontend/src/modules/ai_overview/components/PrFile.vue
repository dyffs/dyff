<template>
  <div
    class="pr-file flex items-start gap-2 cursor-pointer hover:bg-secondary-foreground hover:text-info rounded-md px-2 py-1 group"
    @click="navigateToFile"
  >
    <input
      v-model="reviewed"
      type="checkbox"
      class="cursor-normal mt-0.5"
      @click.stop
    >
    <span class="text-primary group-hover:text-info break-all text-[12px]">
      <slot />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots, type VNode } from 'vue'
import { useCodeReview } from '@/modules/code_review/useCodeReview'
import { useDiffNavigate } from '@/modules/code_review/useDiffNavigate'

const { isFileReviewed, toggleFileReviewed, getFileByPath } = useCodeReview()!
const { handleSelectFile } = useDiffNavigate()!

const slots = useSlots()

function extractText (vnodes: VNode[]): string {
  return vnodes.map(vnode => {
    if (typeof vnode === 'string') return vnode
    if (typeof vnode.children === 'string') return vnode.children
    if (Array.isArray(vnode.children)) return extractText(vnode.children as VNode[])
    return ''
  }).join('')
}

function parseSlotContent (): { path: string, line?: number } | undefined {
  const slot = slots.default?.()
  if (!slot || slot.length === 0) return undefined
  const text = extractText(slot).trim()
  if (!text) return undefined

  const match = text.match(/^(.+?):(\d+)(?:-\d+)?$/)
  if (match) {
    return { path: match[1] || '', line: parseInt(match[2] || '0', 10) }
  }
  return { path: text }
}

const reviewed = computed({
  get: () => {
    const parsed = parseSlotContent()
    return parsed ? isFileReviewed(parsed.path) : false
  },
  set: () => {
    const parsed = parseSlotContent()
    if (parsed) {
      toggleFileReviewed(parsed.path)
    }
  },
})

function navigateToFile () {
  const parsed = parseSlotContent()
  if (!parsed) return
  const file = getFileByPath(parsed.path)
  if (!file) return
  void handleSelectFile({
    fileId: file.id,
    line: parsed.line ? { lineNumber: parsed.line, side: 'RIGHT' } : undefined,
    options: { expanded: true, flashing: !!parsed.line },
  })
}
</script>
