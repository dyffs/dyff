import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki'

let highlighterInstance: Highlighter | null = null
let highlighterPromise: Promise<Highlighter> | null = null

/**
 * Get or create the Shiki highlighter instance
 */
export async function getHighlighter (): Promise<Highlighter> {
  if (highlighterInstance) {
    return highlighterInstance
  }

  if (highlighterPromise) {
    return highlighterPromise
  }

  highlighterPromise = createHighlighter({
    themes: ['github-light'],
    langs: [
      'javascript', 'typescript', 'jsx', 'tsx', 'vue', 'python', 'ruby',
      'java', 'go', 'rust', 'c', 'cpp', 'csharp', 'php', 'swift', 'kotlin',
      'bash', 'json', 'yaml', 'xml', 'toml', 'markdown', 'html', 'css',
      'scss', 'sass', 'sql', 'graphql', 'dockerfile', 'makefile'
    ]
  }).then((highlighter) => {
    highlighterInstance = highlighter
    return highlighter
  })

  return highlighterPromise
}

/**
 * Map file extensions to Shiki language identifiers
 */
const extensionToLanguage: Record<string, BundledLanguage> = {
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.vue': 'vue',
  '.py': 'python',
  '.rb': 'ruby',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.dockerfile': 'dockerfile',
}

/**
 * Detect language from filename
 */
export function detectLanguage (filename: string): BundledLanguage {
  const lowerFilename = filename.toLowerCase()

  // Special filenames
  if (lowerFilename === 'dockerfile') return 'dockerfile'
  if (lowerFilename === 'makefile') return 'makefile'
  if (lowerFilename === 'gemfile' || lowerFilename === 'rakefile') return 'ruby'
  if (lowerFilename === 'cargo.toml') return 'toml'

  // Check extension
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  return extensionToLanguage[ext] || 'javascript' // Fallback to javascript
}

/**
 * Highlight code with Shiki
 */
export async function highlightCode (code: string, filename: string): Promise<string> {
  const highlighter = await getHighlighter()
  const language = detectLanguage(filename)

  try {
    return highlighter.codeToHtml(code, {
      lang: language,
      theme: 'github-light'
    })
  } catch (error) {
    console.error('Failed to highlight code:', error)
    // Fallback to plain text
    return `<pre><code>${escapeHtml(code)}</code></pre>`
  }
}

/**
 * Highlight a single line of code
 */
export async function highlightLine (line: string, filename: string): Promise<string> {
  const highlighter = await getHighlighter()
  const language = detectLanguage(filename)

  try {
    const html = highlighter.codeToHtml(line, {
      lang: language,
      theme: 'github-light'
    })

    // Extract just the content without the wrapping <pre><code> tags
    const match = html.match(/<code[^>]*>(.*?)<\/code>/s)
    return match?.[1] ?? escapeHtml(line)
  } catch (error) {
    console.error('Failed to highlight line:', error)
    return escapeHtml(line)
  }
}

/**
 * Escape HTML
 */
function escapeHtml (text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
