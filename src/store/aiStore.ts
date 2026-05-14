import { create } from 'zustand'
import type { AiModelInfo, AiProviderMetrics, AiProviderRuntimeStatus, AiProviderSettings, ParsedIntent } from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface AiStore {
  latestIntent: ParsedIntent | null
  isExecuting: boolean
  providerSettings: AiProviderSettings | null
  localModels: AiModelInfo[]
  providerMetrics: AiProviderMetrics[]
  offlineStatus: AiProviderRuntimeStatus | null
  loadProviderContext: () => Promise<void>
  parseInput: (input: string) => Promise<void>
  executeInput: (input: string) => Promise<void>
}

export const useAiStore = create<AiStore>((set) => ({
  latestIntent: null,
  isExecuting: false,
  providerSettings: null,
  localModels: [],
  providerMetrics: [],
  offlineStatus: null,
  loadProviderContext: async () => {
    const [providerSettings, localModels, offlineStatus, providerMetrics] = await Promise.all([
      desktopClient.getAiProviderSettings(),
      desktopClient.getAiProviderModels(),
      desktopClient.getAiProviderStatus(),
      desktopClient.getAiProviderMetrics(),
    ])
    set({
      providerSettings,
      localModels,
      offlineStatus,
      providerMetrics,
    })
  },
  parseInput: async (input) => {
    const parsed = await desktopClient.parseIntent(input)
    set({ latestIntent: parsed })
  },
  executeInput: async (input) => {
    set({ isExecuting: true })
    await desktopClient.executeIntent(input)
    set({ isExecuting: false })
  },
}))
