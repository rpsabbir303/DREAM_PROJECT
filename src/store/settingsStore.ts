import { create } from 'zustand'
import type { AiModelInfo, AiProviderMetrics, AiProviderRuntimeStatus, AiProviderSettings, SemanticMemoryHit } from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

type ThemeMode = 'midnight' | 'obsidian'

interface SettingsStore {
  theme: ThemeMode
  safeMode: boolean
  aiSettings: AiProviderSettings | null
  aiModels: AiModelInfo[]
  aiMetrics: AiProviderMetrics[]
  offlineStatus: AiProviderRuntimeStatus | null
  semanticHits: SemanticMemoryHit[]
  isLoadingAi: boolean
  error: string | null
  setTheme: (theme: ThemeMode) => void
  setSafeMode: (safeMode: boolean) => void
  loadAiSettings: () => Promise<void>
  updateAiSettings: (settings: Partial<AiProviderSettings>) => Promise<void>
  searchSemanticMemory: (query: string) => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  theme: 'midnight',
  safeMode: true,
  aiSettings: null,
  aiModels: [],
  aiMetrics: [],
  offlineStatus: null,
  semanticHits: [],
  isLoadingAi: false,
  error: null,
  setTheme: (theme) => set({ theme }),
  setSafeMode: (safeMode) => set({ safeMode }),
  loadAiSettings: async () => {
    set({ isLoadingAi: true, error: null })
    try {
      const [aiSettings, aiModels, offlineStatus, aiMetrics] = await Promise.all([
        desktopClient.getAiProviderSettings(),
        desktopClient.getAiProviderModels(),
        desktopClient.getAiProviderStatus(),
        desktopClient.getAiProviderMetrics(),
      ])
      set({
        aiSettings,
        aiModels,
        offlineStatus,
        aiMetrics,
        isLoadingAi: false,
      })
    } catch (error) {
      set({ isLoadingAi: false, error: error instanceof Error ? error.message : 'Failed to load AI settings.' })
    }
  },
  updateAiSettings: async (settings) => {
    const updated = await desktopClient.updateAiProviderSettings(settings)
    if (!updated) {
      set({ error: 'Failed to update AI settings.' })
      return
    }
    set({ aiSettings: updated, error: null })
  },
  searchSemanticMemory: async (query) => {
    const semanticHits = await desktopClient.semanticMemorySearch(query)
    set({ semanticHits })
  },
}))
