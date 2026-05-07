import type { RepoContent } from '@/types'

export interface SearchMatch {
  index: number
  line: number
  column: number
  lineContent: string
}

export interface SearchResult {
  filePath: string
  matches: SearchMatch[]
}

export interface SearchResponse {
  results: SearchResult[]
  totalMatches: number
  searchTime: number
}

// Worker message types
export type WorkerRequest =
  | { type: 'load', payload: RepoContent }
  | { type: 'search', payload: { keyword: string, filePattern?: string } }
  | { type: 'clear', payload: undefined }

export type WorkerResponse =
  | { type: 'load-complete', success: boolean }
  | { type: 'search-result', payload: SearchResponse }
  | { type: 'error', error: string }

export interface SearchState {
  activeTab: 'file' | 'code'
  fileSearch: FileSearchState
  codeSearch: CodeSearchState
}

export interface FileSearchState {
  fileNameQuery: string
}


export interface CodeSearchState {
  searchKeyword: string
  filePattern: string
}