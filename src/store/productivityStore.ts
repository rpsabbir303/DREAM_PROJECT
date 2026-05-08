import { create } from 'zustand'
import type {
  DevTask,
  ProductivityInsights,
  ProjectContext,
  TerminalAnalysisResult,
  UiUxAnalysisResult,
} from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface ProductivityStore {
  projectContext: ProjectContext | null
  terminalInput: string
  terminalAnalysis: TerminalAnalysisResult | null
  uiUxAnalysis: UiUxAnalysisResult | null
  generatedTasks: DevTask[]
  insights: ProductivityInsights | null
  taskPrompt: string
  isLoading: boolean
  error: string | null
  setTerminalInput: (value: string) => void
  setTaskPrompt: (value: string) => void
  loadProductivityContext: () => Promise<void>
  analyzeTerminal: () => Promise<void>
  analyzeUiUx: () => Promise<void>
  generateTasks: () => Promise<void>
}

export const useProductivityStore = create<ProductivityStore>((set, get) => ({
  projectContext: null,
  terminalInput: '',
  terminalAnalysis: null,
  uiUxAnalysis: null,
  generatedTasks: [],
  insights: null,
  taskPrompt: '',
  isLoading: false,
  error: null,
  setTerminalInput: (terminalInput) => set({ terminalInput }),
  setTaskPrompt: (taskPrompt) => set({ taskPrompt }),
  loadProductivityContext: async () => {
    set({ isLoading: true, error: null })
    try {
      const [projectContext, insights] = await Promise.all([
        desktopClient.getProjectContext(),
        desktopClient.getProductivityInsights(),
      ])
      set({ projectContext, insights, isLoading: false })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load productivity context.',
      })
    }
  },
  analyzeTerminal: async () => {
    const text = get().terminalInput.trim()
    if (!text) return
    const terminalAnalysis = await desktopClient.analyzeTerminalOutput(text)
    set({ terminalAnalysis })
  },
  analyzeUiUx: async () => {
    const uiUxAnalysis = await desktopClient.analyzeUiUx()
    set({ uiUxAnalysis })
  },
  generateTasks: async () => {
    const prompt = get().taskPrompt.trim()
    if (!prompt) return
    const generatedTasks = await desktopClient.generateDevTasks(prompt)
    set({ generatedTasks })
  },
}))
