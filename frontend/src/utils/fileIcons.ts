/**
 * Maps file extensions to devicon class names
 * See: https://devicon.dev for available icons
 */

interface FileIconConfig {
  icon: string;
}

const extensionToIcon: Record<string, FileIconConfig> = {
  // JavaScript/TypeScript
  '.js': { icon: 'devicon-javascript-plain' },
  '.jsx': { icon: 'devicon-react-original' },
  '.ts': { icon: 'devicon-typescript-plain' },
  '.tsx': { icon: 'devicon-react-original' },
  '.mjs': { icon: 'devicon-javascript-plain' },
  '.cjs': { icon: 'devicon-javascript-plain' },

  // Vue
  '.vue': { icon: 'devicon-vuejs-plain' },

  // Styles
  '.css': { icon: 'devicon-css3-plain' },
  '.scss': { icon: 'devicon-sass-original' },
  '.sass': { icon: 'devicon-sass-original' },
  '.less': { icon: 'devicon-less-plain-wordmark' },

  // HTML
  '.html': { icon: 'devicon-html5-plain' },
  '.htm': { icon: 'devicon-html5-plain' },

  // Python
  '.py': { icon: 'devicon-python-plain' },
  '.pyw': { icon: 'devicon-python-plain' },
  '.pyx': { icon: 'devicon-python-plain' },

  // Java
  '.java': { icon: 'devicon-java-plain' },
  '.class': { icon: 'devicon-java-plain' },
  '.jar': { icon: 'devicon-java-plain' },

  // Go
  '.go': { icon: 'devicon-go-original-wordmark' },

  // Rust
  '.rs': { icon: 'devicon-rust-original' },

  // C/C++
  '.c': { icon: 'devicon-c-plain' },
  '.h': { icon: 'devicon-c-plain' },
  '.cpp': { icon: 'devicon-cplusplus-plain' },
  '.cc': { icon: 'devicon-cplusplus-plain' },
  '.cxx': { icon: 'devicon-cplusplus-plain' },
  '.hpp': { icon: 'devicon-cplusplus-plain' },

  // C#
  '.cs': { icon: 'devicon-csharp-plain' },

  // PHP
  '.php': { icon: 'devicon-php-plain' },

  // Ruby
  '.rb': { icon: 'devicon-ruby-plain' },
  '.erb': { icon: 'devicon-ruby-plain' },

  // Swift
  '.swift': { icon: 'devicon-swift-plain' },

  // Kotlin
  '.kt': { icon: 'devicon-kotlin-plain' },
  '.kts': { icon: 'devicon-kotlin-plain' },

  // Shell
  '.sh': { icon: 'devicon-bash-plain' },
  '.bash': { icon: 'devicon-bash-plain' },
  '.zsh': { icon: 'devicon-bash-plain' },

  // Config/Data files
  '.json': { icon: 'devicon-json-plain' },
  '.yaml': { icon: 'devicon-yaml-plain' },
  '.yml': { icon: 'devicon-yaml-plain' },
  '.xml': { icon: 'devicon-xml-plain' },
  '.toml': { icon: 'devicon-toml-plain' },

  // Markdown
  '.md': { icon: 'devicon-markdown-original' },
  '.markdown': { icon: 'devicon-markdown-original' },

  // Docker
  '.dockerfile': { icon: 'devicon-docker-plain' },

  // Git
  '.gitignore': { icon: 'devicon-git-plain' },
  '.gitattributes': { icon: 'devicon-git-plain' },

  // SQL
  '.sql': { icon: 'devicon-mysql-plain' },

  // GraphQL
  '.graphql': { icon: 'devicon-graphql-plain' },
  '.gql': { icon: 'devicon-graphql-plain' },

  // Images
  '.svg': { icon: 'devicon-svg-plain' },

  // Other
  '.lock': { icon: 'devicon-npm-original-wordmark' },
}

// Special filename mappings (for files without extensions or special names)
const filenameToIcon: Record<string, FileIconConfig> = {
  'package.json': { icon: 'devicon-npm-original-wordmark' },
  'package-lock.json': { icon: 'devicon-npm-original-wordmark' },
  'tsconfig.json': { icon: 'devicon-typescript-plain' },
  'webpack.config.js': { icon: 'devicon-webpack-plain' },
  'vite.config.ts': { icon: 'devicon-vitejs-plain' },
  'vite.config.js': { icon: 'devicon-vitejs-plain' },
  'dockerfile': { icon: 'devicon-docker-plain' },
  'docker-compose.yml': { icon: 'devicon-docker-plain' },
  'docker-compose.yaml': { icon: 'devicon-docker-plain' },
  '.gitignore': { icon: 'devicon-git-plain' },
  '.gitattributes': { icon: 'devicon-git-plain' },
  'readme.md': { icon: 'devicon-markdown-original' },
  'readme': { icon: 'devicon-markdown-original' },
  'makefile': { icon: 'devicon-c-plain' },
  'gemfile': { icon: 'devicon-ruby-plain' },
  'rakefile': { icon: 'devicon-ruby-plain' },
  'cargo.toml': { icon: 'devicon-rust-original' },
  'go.mod': { icon: 'devicon-go-original-wordmark' },
  'go.sum': { icon: 'devicon-go-original-wordmark' },
}

/**
 * Get the devicon class name for a file based on its name
 */
export function getFileIcon (fileName: string): string {
  const lowerFileName = fileName.toLowerCase()

  // Check special filenames first
  if (filenameToIcon[lowerFileName]) {
    const config = filenameToIcon[lowerFileName]
    return `${config.icon} colored`
  }

  // Check by extension
  const ext = getFileExtension(fileName)
  if (ext && extensionToIcon[ext]) {
    const config = extensionToIcon[ext]
    return `${config.icon} colored`
  }

  // Default file icon
  return ''
}

/**
 * Get file extension including the dot (e.g., '.js', '.tsx')
 */
function getFileExtension (fileName: string): string | null {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1 || lastDot === 0) {
    return null
  }
  return fileName.substring(lastDot).toLowerCase()
}

/**
 * Get the folder icon class
 */
export function getFolderIcon (): string {
  return 'devicon-folder-plain'
}
