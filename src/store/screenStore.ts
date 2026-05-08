import { create } from 'zustand'
import type { ActiveWindowInfo, ScreenAnalysisResult, ScreenCaptureRecord } from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface ScreenStore {
  latestCapture: ScreenCaptureRecord | null
  latestAnalysis: ScreenAnalysisResult | null
  activeWindow: ActiveWindowInfo | null
  history: ScreenAnalysisResult[]
  isCapturing: boolean
  isAnalyzing: boolean
  error: string | null
  captureScreen: (source?: 'full_screen' | 'active_window') => Promise<void>
  analyzeScreen: () => Promise<void>
  refreshActiveWindow: () => Promise<void>
  loadHistory: () => Promise<void>
}

export const useScreenStore = create<ScreenStore>((set) => ({
  latestCapture: null,
  latestAnalysis: null,
  activeWindow: null,
  history: [],
  isCapturing: false,
  isAnalyzing: false,
  error: null,
  captureScreen: async (source = 'full_screen') => {
    set({ isCapturing: true, error: null })
    try {
      const latestCapture = await desktopClient.captureScreen(source)
      set({ latestCapture: latestCapture ?? null, isCapturing: false })
    } catch (error) {
      set({ isCapturing: false, error: error instanceof Error ? error.message : 'Screen capture failed.' })
    }
  },
  analyzeScreen: async () => {
    set({ isAnalyzing: true, error: null })
    try {
      const latestAnalysis = await desktopClient.analyzeLatestScreen()
      const activeWindow = await desktopClient.getActiveWindow()
      const history = await desktopClient.getScreenHistory()
      set({ latestAnalysis: latestAnalysis ?? null, activeWindow, history, isAnalyzing: false })
    } catch (error) {
      set({ isAnalyzing: false, error: error instanceof Error ? error.message : 'Screen analysis failed.' })
    }
  },
  refreshActiveWindow: async () => {
    const activeWindow = await desktopClient.getActiveWindow()
    set({ activeWindow })
  },
  loadHistory: async () => {
    const history = await desktopClient.getScreenHistory()
    set({ history })
  },
}))
