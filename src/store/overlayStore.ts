import { create } from 'zustand'
import type {
  AssistantOverlayState,
  CommandPaletteItem,
  GlobalShortcutBindings,
  WorkspaceContext,
} from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface OverlayStore {
  state: AssistantOverlayState | null
  shortcuts: GlobalShortcutBindings | null
  workspaceContext: WorkspaceContext | null
  paletteQuery: string
  paletteItems: CommandPaletteItem[]
  isLoading: boolean
  error: string | null
  setPaletteQuery: (query: string) => void
  loadOverlayEnvironment: () => Promise<void>
  setVisible: (visible: boolean) => Promise<void>
  setDocked: (docked: boolean) => Promise<void>
  setVoiceMode: (voiceMode: boolean) => Promise<void>
  setQuickAutomation: (enabled: boolean) => Promise<void>
  updateShortcuts: (bindings: Partial<GlobalShortcutBindings>) => Promise<void>
  searchPalette: (query: string) => Promise<void>
}

export const useOverlayStore = create<OverlayStore>((set) => ({
  state: null,
  shortcuts: null,
  workspaceContext: null,
  paletteQuery: '',
  paletteItems: [],
  isLoading: false,
  error: null,
  setPaletteQuery: (paletteQuery) => set({ paletteQuery }),
  loadOverlayEnvironment: async () => {
    set({ isLoading: true, error: null })
    try {
      const [state, shortcuts, workspaceContext] = await Promise.all([
        desktopClient.getOverlayState(),
        desktopClient.getShortcutBindings(),
        desktopClient.getWorkspaceContext(),
      ])
      set({ state, shortcuts, workspaceContext, isLoading: false })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load overlay environment.',
      })
    }
  },
  setVisible: async (visible) => {
    const state = await desktopClient.setOverlayVisible(visible)
    if (state) set({ state })
  },
  setDocked: async (docked) => {
    const state = await desktopClient.setOverlayDocked(docked)
    if (state) set({ state })
  },
  setVoiceMode: async (voiceMode) => {
    const state = await desktopClient.setOverlayVoiceMode(voiceMode)
    if (state) set({ state })
  },
  setQuickAutomation: async (enabled) => {
    const state = await desktopClient.setOverlayQuickAutomation(enabled)
    if (state) set({ state })
  },
  updateShortcuts: async (bindings) => {
    const shortcuts = await desktopClient.setShortcutBindings(bindings)
    if (shortcuts) set({ shortcuts })
  },
  searchPalette: async (query) => {
    const paletteItems = await desktopClient.searchCommandPalette(query)
    set({ paletteItems, paletteQuery: query })
  },
}))
