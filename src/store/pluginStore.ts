import { create } from 'zustand'
import type { SkillCapabilityOverview, SkillDefinition } from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface PluginStore {
  skills: SkillDefinition[]
  overview: SkillCapabilityOverview | null
  isLoading: boolean
  error: string | null
  loadSkills: () => Promise<void>
  setSkillEnabled: (skillId: string, enabled: boolean) => Promise<void>
}

export const usePluginStore = create<PluginStore>((set) => ({
  skills: [],
  overview: null,
  isLoading: false,
  error: null,
  loadSkills: async () => {
    set({ isLoading: true, error: null })
    try {
      const [skills, overview] = await Promise.all([
        desktopClient.listSkills(),
        desktopClient.getSkillCapabilityOverview(),
      ])
      set({ skills, overview, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to load skills.' })
    }
  },
  setSkillEnabled: async (skillId, enabled) => {
    const skills = await desktopClient.setSkillEnabled(skillId, enabled)
    const overview = await desktopClient.getSkillCapabilityOverview()
    set({ skills, overview })
  },
}))
