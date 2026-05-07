import { defineComponent, h, type Component, type VNode } from 'vue'
import { marked } from 'marked'
import PrIntent from './components/PrIntent.vue'
import PrGroup from './components/PrGroup.vue'
import PrReadingFlow from './components/PrReadingFlow.vue'
import PrFile from './components/PrFile.vue'
import PrFinding from './components/PrFinding.vue'
import PrFindingDescription from './components/PrFindingDescription.vue'
import { isString } from 'lodash-es'

const TAG_MAP: Record<string, Component> = {
  printent: PrIntent,
  prreadingflow: PrReadingFlow,
  prgroup: PrGroup,
  prfile: PrFile,
  prfinding: PrFinding,
  prfindingdescription: PrFindingDescription,
}

const PARSE_CHILDREN_AS_MARKDOWN = ['printent', 'prfindingdescription']

const CUSTOM_TAG_NAMES = Object.keys(TAG_MAP)

/**
 * Ensure custom tags are treated as block-level HTML by marked
 * by adding blank lines around opening/closing tags.
 */
function ensureBlockLevelCustomTags (content: string): string {
  const tagPattern = CUSTOM_TAG_NAMES.join('|')
  const regex = new RegExp(`(<\\/?(${tagPattern})(\\s[^>]*)?>)`, 'gi')
  return content.replace(regex, '\n\n$1\n\n')
}

function parsePlainMarkdown (text: string) {
  const parsed = marked.parse(text, { async: false })

  const doc = new DOMParser().parseFromString(parsed, 'text/html')

  return Array.from(doc.body.childNodes).map(domToVNode).filter((v): v is VNode | string => v != null)
}

function domToVNode (node: Node): VNode | string | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const component = TAG_MAP[tag]

  const attrs: Record<string, string> = {}
  for (const attr of el.attributes) {
    attrs[attr.name] = attr.value
  }

  const children = Array.from(el.childNodes)
    .map(domToVNode)
    .filter((v): v is VNode | string => v != null)
  

  if (component) {
    if (PARSE_CHILDREN_AS_MARKDOWN.includes(tag)) {
      const parsed = children.map(c => isString(c) ? parsePlainMarkdown(c) : c)
      return h(component, attrs, () => parsed)
    }

    return h(component, attrs, () => children)
  }
  return h(tag, attrs, children)
}

export default defineComponent({
  name: 'MarkdownRenderer',
  props: {
    content: {
      type: String,
      required: true,
    },
  },
  render () {
    const preprocessed = ensureBlockLevelCustomTags(this.content)
    const html = marked.parse(preprocessed, { async: false })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const children = Array.from(doc.body.childNodes)
      .map(domToVNode)
      .filter((v): v is VNode | string => v != null)

    return h('div', children)
  },
})
