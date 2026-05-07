import { ref, watch, onUnmounted } from 'vue'
import { marked } from 'marked'
import * as nodeEmoji from 'node-emoji'
import apiClient from '@/modules/apiClient'

function emojify (text: string): string {
  return text.replace(/:([a-zA-Z0-9_+-]+):/g, (match, name: string) => {
    const emoji = nodeEmoji.get(name)
    // node-emoji returns the input with colons if not found
    return emoji && emoji !== `:${name}:` ? emoji : match
  })
}

const GITHUB_ASSET_REGEX = /https:\/\/github\.com\/user-attachments\/assets\/([a-f0-9-]+)/g
const PRIVATE_ASSET_SRC_REGEX = /(?:src|href)="(https:\/\/private-user-images\.githubusercontent\.com\/[^"]+)"/g
const ASSET_ID_IN_URL_REGEX = /\/\d+-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\./

interface AssetResult {
  blobUrl: string
  contentType: string
  isVideo: boolean
}

function escapeRegex (str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractAssetDownloadUrls (preRenderedHtml: string): Map<string, string> {
  const assetMap = new Map<string, string>()
  for (const match of preRenderedHtml.matchAll(PRIVATE_ASSET_SRC_REGEX)) {
    const url = match[1]!.replace(/&amp;/g, '&')
    const idMatch = url.match(ASSET_ID_IN_URL_REGEX)
    if (idMatch?.[1] && !assetMap.has(idMatch[1])) {
      assetMap.set(idMatch[1], url)
    }
  }
  return assetMap
}

async function loadGithubAsset (assetId: string, downloadUrl: string | undefined, blobUrls: string[]): Promise<AssetResult> {
  const response = await apiClient.get(`/assets/github-asset/${assetId}`, {
    responseType: 'blob',
    params: downloadUrl ? { url: downloadUrl } : undefined
  })
  const blobUrl = URL.createObjectURL(response.data)
  blobUrls.push(blobUrl)

  const contentType = response.headers['content-type'] || ''
  const isVideo = contentType.startsWith('video/')

  return { blobUrl, contentType, isVideo }
}

async function processMarkdown (markdown: string, preRenderedHtml: string, blobUrls: string[]): Promise<string> {
  let html = emojify(marked.parse(markdown, { async: false }))

  const downloadUrlMap = extractAssetDownloadUrls(preRenderedHtml)

  const matches = html.matchAll(GITHUB_ASSET_REGEX)
  const assetReplacements: {
    original: string
    blobUrl: string
    isVideo: boolean
  }[] = []

  const fetchPromises: Promise<void>[] = []
  for (const match of matches) {
    const originalUrl = match[0]
    const assetId = match[1]

    if (!assetId || assetReplacements.some(r => r.original === originalUrl)) continue

    fetchPromises.push(
      loadGithubAsset(assetId, downloadUrlMap.get(assetId), blobUrls)
        .then(result => {
          assetReplacements.push({
            original: originalUrl,
            blobUrl: result.blobUrl,
            isVideo: result.isVideo
          })
        })
        .catch((error: unknown) => {
          console.error(`Failed to load GitHub asset ${assetId}:`, error)
        })
    )
  }

  await Promise.all(fetchPromises)

  for (const { original, blobUrl } of assetReplacements) {
    html = html.split(original).join(blobUrl)
  }

  for (const { blobUrl, isVideo } of assetReplacements) {
    if (isVideo) {
      const imgRegex = new RegExp(`<img[^>]*src="${escapeRegex(blobUrl)}"[^>]*>`, 'g')
      html = html.replace(imgRegex, `<video src="${blobUrl}" controls class="rounded-md my-4 max-w-full"></video>`)
    }
  }

  return html
}

function cleanupBlobUrls (blobUrls: string[]) {
  for (const url of blobUrls) {
    URL.revokeObjectURL(url)
  }
  blobUrls.length = 0
}

interface MarkdownAndHtml {
  markdown: string
  preRenderedHtml: string
}

export function useMarkdownRenderer (getMarkdownAndHtml: () => MarkdownAndHtml | null | undefined) {
  const renderedHtml = ref('')
  const blobUrls: string[] = []

  watch(getMarkdownAndHtml, async (data) => {
    cleanupBlobUrls(blobUrls)

    if (!data || !data.markdown) {
      renderedHtml.value = ''
      return
    }

    renderedHtml.value = await processMarkdown(data.markdown, data.preRenderedHtml, blobUrls)
  }, { immediate: true })

  onUnmounted(() => {
    cleanupBlobUrls(blobUrls)
  })

  return {
    renderedHtml
  }
}
