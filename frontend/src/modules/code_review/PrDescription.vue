<template>
  <div class="flex flex-col p-4">
    <div
      v-if="description"
      :class="`prose ${MARKDOWN_STYLES_CLASS}`"
      v-html="renderedHtml"
    />
    <div
      v-else
      class="flex-1 flex items-center justify-center text-muted-foreground text-sm"
    >
      No description provided
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMarkdownRenderer } from '@/utils/markdownRendererGithub'
import { MARKDOWN_STYLES_CLASS } from '../common/styles'

interface Props {
  description: string | null
  htmlDescription: string | null
}

const props = defineProps<Props>()

const { renderedHtml } = useMarkdownRenderer(() => ({
  markdown: props.description ?? '',
  preRenderedHtml: props.htmlDescription ?? ''
}))
</script>

<style>
/* Video styling for prose */
.prose video {
  max-width: 100%;
  height: auto;
}
</style>
