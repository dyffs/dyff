import fs from 'fs/promises'
import https from 'https'
import path from 'path'
import { URL } from 'url'
import { fileTypeFromBuffer } from 'file-type'
import { logger } from './logger'

const GITHUB_ASSET_CACHE_PATH = process.env.GITHUB_ASSET_PATH

interface DownloadGithubAssetResult {
  filePath: string
  contentType?: string
}

function getAsset(fileUrl: string): Promise<{ data: Buffer; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(fileUrl)
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
      }
    }

    const req = https.request(options, (res) => {
      if (!res.statusCode || res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch asset: ${res.statusCode} ${res.statusMessage}`))
      }

      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          data: Buffer.concat(chunks),
          headers: res.headers as Record<string, string>,
        })
      })
    })

    req.on('error', reject)
    req.end()
  })
}

/**
 * Download a GitHub asset and cache it locally
 * Supports both PAT and GitHub App authentication
 *
 * @param imageId - The GitHub asset ID (hash from the URL) - used for caching
 * @param userId - User ID for permission isolation
 * @param downloadUrl - Optional pre-authenticated download URL (e.g., GitHub private-user-images link with JWT)
 * @returns Object containing the file path and content type
 */
export async function downloadGithubAsset(
  imageId: string,
  userId: string,
  downloadUrl?: string
): Promise<DownloadGithubAssetResult> {
  if (!GITHUB_ASSET_CACHE_PATH) {
    throw new Error('GITHUB_ASSET_PATH environment variable not configured')
  }

  // Build cache path with user ID for permission isolation
  const userCacheDir = path.join(GITHUB_ASSET_CACHE_PATH, userId)
  const cachedFilePath = path.join(userCacheDir, imageId)
  const metadataPath = path.join(userCacheDir, `${imageId}.meta.json`)

  logger.info('cachedFilePath', cachedFilePath)

  // Check if file exists in cache
  try {
    await fs.access(cachedFilePath)

    // Try to read content type from metadata file
    let contentType: string | undefined
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
      contentType = metadata.contentType
    } catch {
      // Metadata file doesn't exist or is invalid, continue without content type
    }

    // File exists, return cached path with content type
    return { filePath: cachedFilePath, contentType }
  } catch {
    // File doesn't exist, proceed to download
  }

  if (!downloadUrl) {
    throw new Error('No download URL provided')
  }

  // Use provided download URL if available, otherwise construct from imageId
  const assetUrl = downloadUrl || `https://github.com/user-attachments/assets/${imageId}`
  const { data: bufferData, headers } = await getAsset(assetUrl)

  // Get content type from response headers
  let contentType = headers['content-type'] || undefined

  // If GitHub returns a generic type or no type, detect from file magic bytes
  if (!contentType || contentType === 'application/octet-stream') {
    const detectedType = await fileTypeFromBuffer(bufferData)
    if (detectedType) {
      contentType = detectedType.mime
      logger.info('Detected content-type from buffer:', contentType)
    }
  }

  // Ensure cache directory exists
  await fs.mkdir(userCacheDir, { recursive: true })

  // Save to cache
  await fs.writeFile(cachedFilePath, bufferData)

  // Save metadata (content type) alongside the file
  if (contentType) {
    await fs.writeFile(metadataPath, JSON.stringify({ contentType }))
  }

  return {
    filePath: cachedFilePath,
    contentType
  }
}
