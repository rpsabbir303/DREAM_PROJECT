import { create } from 'zustand'
import type { PersonalizationSuggestion } from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface PersonalizationStore {
  suggestions: PersonalizationSuggestion[]
  loadSuggestions: () => Promise<void>
}

export const usePersonalizationStore = create<PersonalizationStore>((set) => ({
  suggestions: [],
  loadSuggestions: async () => {
    const suggestions = await desktopClient.getSuggestions()
    set({ suggestions })
  },
}))
