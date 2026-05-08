import { create } from 'zustand'
import { dashboardSnapshot } from '@/services/mock/dashboardData'
import type { DashboardSnapshot } from '@/types/system'

type ThemeMode = 'midnight' | 'obsidian'

interface AppState {
  theme: ThemeMode
  dashboard: DashboardSnapshot
  isOrbActive: boolean
  toggleOrb: () => void
  setTheme: (theme: ThemeMode) => void
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'midnight',
  dashboard: dashboardSnapshot,
  isOrbActive: true,
  toggleOrb: () => set((state) => ({ isOrbActive: !state.isOrbActive })),
  setTheme: (theme) => set({ theme }),
}))
