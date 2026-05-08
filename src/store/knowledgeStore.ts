import { create } from 'zustand'
import type {
  ContextRetrievalResult,
  IndexingStatus,
  KnowledgeGraphSnapshot,
  SemanticSearchResult,
} from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface KnowledgeStore {
  indexingStatus: IndexingStatus | null
  semanticResults: SemanticSearchResult[]
  graph: KnowledgeGraphSnapshot | null
  retrieval: ContextRetrievalResult | null
  query: string
  isLoading: boolean
  error: string | null
  setQuery: (query: string) => void
  refreshStatus: () => Promise<void>
  reindex: () => Promise<void>
  search: () => Promise<void>
  loadGraph: () => Promise<void>
  retrieve: (query: string) => Promise<void>
}

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => ({
  indexingStatus: null,
  semanticResults: [],
  graph: null,
  retrieval: null,
  query: '',
  isLoading: false,
  error: null,
  setQuery: (query) => set({ query }),
  refreshStatus: async () => {
    const indexingStatus = await desktopClient.getIndexingStatus()
    set({ indexingStatus })
  },
  reindex: async () => {
    set({ isLoading: true, error: null })
    const result = await desktopClient.reindexKnowledge()
    if (!result.ok) {
      set({ isLoading: false, error: 'Knowledge indexing failed.' })
      return
    }
    const indexingStatus = await desktopClient.getIndexingStatus()
    set({ isLoading: false, indexingStatus })
  },
  search: async () => {
    const query = get().query.trim()
    if (!query) return
    const semanticResults = await desktopClient.semanticKnowledgeSearch({ query, limit: 10 })
    set({ semanticResults })
  },
  loadGraph: async () => {
    const graph = await desktopClient.getKnowledgeGraph()
    set({ graph })
  },
  retrieve: async (query) => {
    const retrieval = await desktopClient.retrieveContext(query)
    set({ retrieval })
  },
}))
