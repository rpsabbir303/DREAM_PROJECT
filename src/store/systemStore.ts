import { create } from 'zustand'
import { systemService } from '@/services/system/systemService'
import type { SystemSnapshot } from '@shared/interfaces/ipc'

interface SystemStore {
  snapshot: SystemSnapshot | null
  isLoading: boolean
  lastUpdatedAt: number | null
  lastError: string | null
  refreshSnapshot: () => Promise<void>
}

export const useSystemStore = create<SystemStore>((set) => ({
  snapshot: null,
  isLoading: false,
  lastUpdatedAt: null,
  lastError: null,
  refreshSnapshot: async () => {
    set({ isLoading: true })
    try {
      const snapshot = await systemService.getSnapshot()
      set({ snapshot, lastError: null, isLoading: false, lastUpdatedAt: Date.now() })
    } catch (error) {
      set({
        lastError: error instanceof Error ? error.message : 'System snapshot failed',
        isLoading: false,
      })
    }
  },
}))
