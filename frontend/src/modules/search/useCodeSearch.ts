import { createInjectionState } from '@vueuse/core'
import { ref } from 'vue'
import { repoSearchService } from './repoSeach'
import { repoStore } from '@/modules/repo/repoStore'
import type { SearchResponse, SearchState } from './searchTypes'
import { toast } from 'vue-sonner'
import type { FileDiff, RepoMeta } from '@/types'
import { hasMatch, score, positions } from '@/lib/fzy'

export interface FileSearchResult {
  path: string
  matchPositions: number[]
}

export interface SelectedFileData {
  filePath: string | null
  fileContent: string | null
  fileDiff: FileDiff | null
  matchedLines: number[]
  searchKeyword?: string
}

function isSameRepo (repo1: RepoMeta, repo2: RepoMeta): boolean {
  return repo1.owner === repo2.owner && repo1.repo === repo2.repo && repo1.commitSha === repo2.commitSha
}

const [useProvideCodeSearch, useCodeSearch] = createInjectionState(() => {
  const isPreparing = ref(false)
  const repoMeta = ref<RepoMeta | null>(null)
  const fileMap = new Map<string, string>()

  // MiniIDE control state
  const isOpen = ref(false)
  const searchState = ref<SearchState>({
    activeTab: 'code',
    fileSearch: { fileNameQuery: '' },
    codeSearch: { searchKeyword: '', filePattern: '' }
  })
  const selectedFileData = ref<SelectedFileData>({
    filePath: null,
    fileContent: null,
    fileDiff: null,
    matchedLines: []
  })

  async function checkReady (repo: RepoMeta): Promise<void> {
    if (repoMeta.value && isSameRepo(repoMeta.value, repo)) {
      return
    }

    isPreparing.value = true

    try {
      // Check if the repo content is available
      const codeContent = await repoStore.readRepoAtCommit(repo.owner, repo.repo, repo.commitSha)

      for (const file of codeContent.files) {
        fileMap.set(file.filePath, file.content)
      }

      const repoSearch = repoSearchService.getCurrentRepo()

      if (!repoSearch || !isSameRepo(repoSearch, repo)) {
        await repoSearchService.loadRepo(repo.owner, repo.repo, repo.commitSha, codeContent)
      }

      repoMeta.value = repo
    } catch (error) {
      toast.error(`Code search is failed to prepare: ${error}`)
    } finally {
      isPreparing.value = false
    }
  }

  async function searchCode (keyword: string, filePattern?: string): Promise<SearchResponse> {
    if (!repoMeta.value) {
      throw new Error('Repo meta is not set')
    }

    return await repoSearchService.search(keyword, filePattern)
  }

  function getFileContent (filePath: string): string | undefined {
    return fileMap.get(filePath)
  }

  function getAllFilePaths (): string[] {
    return Array.from(fileMap.keys())
  }

  function searchFilesByName (query: string): FileSearchResult[] {
    if (!query || query.length < 1) {
      return []
    }

    // Use fuzzy matching with scoring
    const matches: Array<{ path: string, score: number, matchPositions: number[] }> = []

    for (const filePath of getAllFilePaths()) {
      if (hasMatch(query, filePath)) {
        matches.push({
          path: filePath,
          score: score(query, filePath),
          matchPositions: positions(query, filePath)
        })
      }
    }

    // Sort by score (higher is better)
    return matches
      .sort((a, b) => b.score - a.score)
      .map(match => ({ path: match.path, matchPositions: match.matchPositions }))
  }

  /** Open MiniIDE and trigger a code search for the given keyword */
  function triggerCodeSearch (keyword: string, filePattern?: string) {
    searchState.value = {
      activeTab: 'code',
      fileSearch: searchState.value.fileSearch,
      codeSearch: { searchKeyword: keyword, filePattern: filePattern ?? '' }
    }
    // Clear preview so MiniIDE shows fresh results
    selectedFileData.value = { filePath: null, fileContent: null, fileDiff: null, matchedLines: [] }
    isOpen.value = true
  }

  /** Open MiniIDE and trigger a file name search */
  function triggerFileSearch (fileName: string) {
    searchState.value = {
      activeTab: 'file',
      fileSearch: { fileNameQuery: fileName },
      codeSearch: searchState.value.codeSearch
    }
    selectedFileData.value = { filePath: null, fileContent: null, fileDiff: null, matchedLines: [] }
    isOpen.value = true
  }

  /** Open MiniIDE with a specific file loaded in the file search tab */
  function openFile (filePath: string) {
    searchState.value = {
      activeTab: 'file',
      fileSearch: { fileNameQuery: filePath },
      codeSearch: searchState.value.codeSearch
    }
    selectedFileData.value = { filePath: null, fileContent: null, fileDiff: null, matchedLines: [] }
    isOpen.value = true
  }

  /** Open MiniIDE preserving the last state */
  function openMiniIDE () {
    isOpen.value = true
  }

  return {
    isPreparing,
    checkReady,
    getFileContent,
    searchCode,
    getAllFilePaths,
    searchFilesByName,
    // MiniIDE control
    isOpen,
    searchState,
    selectedFileData,
    triggerCodeSearch,
    triggerFileSearch,
    openFile,
    openMiniIDE,
  }
})

export { useProvideCodeSearch, useCodeSearch }