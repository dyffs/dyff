export type AgentTool = 'diff_overview' | 'read_file' | 'search_code' | 'list_file' | 'diff_content'

export type LLMModel = 'claude' | 'gemini' | 'glm' | 'deepseek'

export const ALL_TOOLS: { id: AgentTool; label: string; description: string }[] = [
  { id: 'diff_overview', label: 'Diff Overview', description: 'Get a summary of all changes in the PR' },
  { id: 'read_file', label: 'Read File', description: 'Read the contents of a file in the repository' },
  { id: 'search_code', label: 'Search Code', description: 'Search for code patterns across the repository' },
  { id: 'list_file', label: 'List Files', description: 'List files and directories in the repository' },
  { id: 'diff_content', label: 'Diff Content', description: 'Get the detailed diff of specific files' },
]

export const ALL_MODELS: { id: LLMModel; label: string; color: string }[] = [
  { id: 'claude', label: 'Claude', color: 'bg-orange-100 text-orange-700' },
  { id: 'gemini', label: 'Gemini', color: 'bg-blue-100 text-blue-700' },
  { id: 'glm', label: 'GLM', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'deepseek', label: 'Deepseek', color: 'bg-violet-100 text-violet-700' },
]

export interface AgentPreset {
  id: string
  handle: string
  name: string
  description: string
  botUname: string
  languages: string[]
  tools: AgentTool[]
  model: LLMModel
  systemPrompt: string
}

export interface UserAgent {
  id: string
  handle: string
  name: string
  description: string
  botUname: string
  tools: AgentTool[]
  model: LLMModel
  systemPrompt: string
  clonedFromPresetId?: string
}
