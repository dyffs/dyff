import { createInjectionState } from '@vueuse/core'
import { ref } from 'vue'

const [useProvideDiffTextSelection, useDiffTextSelection] = createInjectionState(() => {
  const isOpen = ref(false)
  const selectedText = ref('')
  const virtualAnchor = ref<{ getBoundingClientRect: () => DOMRect } | null>(null)

  function show (text: string, range: Range) {
    selectedText.value = text
    // Use the last client rect — for multi-line selections this stays
    // tightly bound to the text in the content column rather than
    // stretching across line-number cells.
    const rects = range.getClientRects()
    const rect = rects[rects.length - 1] ?? range.getBoundingClientRect()
    virtualAnchor.value = {
      getBoundingClientRect: () => rect
    }
    isOpen.value = true
  }

  function hide () {
    isOpen.value = false
    selectedText.value = ''
    virtualAnchor.value = null
  }

  return { isOpen, selectedText, virtualAnchor, show, hide }
})

export { useProvideDiffTextSelection, useDiffTextSelection }
