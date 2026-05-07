import express from 'express'
import { requestContext } from '@/service/requestContext'
import { downloadGithubAsset } from '@/service/asset_service'
import fs from 'fs/promises'
import { logger } from '@/service/logger'

const router = express.Router()

router.get('/github-asset/:id', async (req: express.Request, res: express.Response) => {
  const user = requestContext.currentUser()
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const imageId = req.params.id
  if (!imageId) {
    return res.status(400).json({ error: 'Image ID is required' })
  }

  // Optional download URL with embedded token (e.g., from GitHub private-user-images)
  const downloadUrl = req.query.url as string | undefined

  try {
    const { filePath, contentType } = await downloadGithubAsset(imageId, user.id, downloadUrl)

    // Set content type (defaults to octet-stream if not detected)
    res.setHeader('Content-Type', contentType || 'application/octet-stream')

    // Set aggressive cache headers since asset IDs are immutable (content-addressed)
    // The hash in the URL IS the content, so it will never change
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('ETag', `"${imageId}"`)

    // Read and send the file manually to preserve Content-Type header
    // (res.sendFile would override it based on file extension)
    const fileBuffer = await fs.readFile(filePath)
    return res.send(fileBuffer)

  } catch (error) {
    logger.error('Error fetching GitHub asset:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'

    // Handle specific error cases
    if (message.includes('not configured')) {
      return res.status(500).json({ error: 'GITHUB_ASSET_PATH not configured' })
    }

    if (message.includes('credential not found')) {
      return res.status(404).json({ error: 'GitHub credential not found' })
    }

    return res.status(500).json({
      error: 'Failed to fetch image',
      details: message
    })
  }
})

export default router