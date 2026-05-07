export const DEFAULT_EXCLUDE_PATTERNS = [
  // --- Package Managers & Lockfiles ---
  // Node.js / JS
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'shrinkwrap.yaml',
  
  // Python
  'Pipfile.lock',
  'poetry.lock',
  
  // PHP
  'composer.lock',
  
  // Ruby
  'Gemfile.lock',
  
  // Rust
  'Cargo.lock',
  
  // Go (Subjective: usually noise, but sometimes relevant for security)
  'go.sum',
  
  // Java / Kotlin
  'gradle.lockfile',
  
  // .NET
  'packages.lock.json',
  
  // Terraform
  '.terraform.lock.hcl',

  // --- Compiled / Binary / minified ---
  // JS Minified
  '*.min.js',
  '*.min.css',
  '*.map', // Source maps are pure noise for AI
  
  // Python Bytecode
  '*.pyc',
  '*.pyo',
  '*.pyd',
  
  // Java / JVM
  '*.jar',
  '*.war',
  '*.ear',
  '*.class',
  
  // C / C++ / Native
  '*.o',
  '*.obj',
  '*.dll',
  '*.so',
  '*.dylib',
  '*.exe',
  '*.lib',
  '*.a',

  // --- Media & Assets (AI cannot "read" these diffs) ---
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.ico',
  '*.pdf',
  '*.mov',
  '*.mp4',
  '*.mp3',
  '*.wav',
  // Note: *.svg is tricky. Sometimes it's just an icon, 
  // sometimes it contains exploitable XML/JS. 
  // Ideally, exclude it unless you are doing a security-specific review.
  '*.svg', 
  '*.woff',
  '*.woff2',
  '*.ttf',
  '*.eot',
  '*.otf',

  // --- Documentation & Auto-Generated ---
  '*.d.ts', // TypeScript definitions (often large, rarely contain logic errors)
  'javadoc/**',
  'docs/_build/**',
  
  // --- System / IDE Configs (if committed by mistake) ---
  '.DS_Store',
  'Thumbs.db',
  '.idea/**',
  '.vscode/**',
  '*.suo',
  '*.ntvs',
  '*.njsproj',
  '*.sln',
  '*.swp',
];