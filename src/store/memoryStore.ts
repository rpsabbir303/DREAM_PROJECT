import { create } from 'zustand'
import type {
  CommandLogRecord,
  CommandMemoryStats,
  PersonalizationSuggestion,
  ProjectMemory,
  WorkflowDefinition,
} from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface MemoryStore {
  recentCommands: CommandLogRecord[]
  commandStats: CommandMemoryStats[]
  workflows: WorkflowDefinition[]
  projects: ProjectMemory[]
  suggestions: PersonalizationSuggestion[]
  isLoading: boolean
  error: string | null
  loadRecentCommands: () => Promise<void>
  loadMemoryOverview: () => Promise<void>
  runWorkflow: (workflowId: string) => Promise<void>
}

export const useMemoryStore = create<MemoryStore>((set) => ({
  recentCommands: [],
  commandStats: [],
  workflows: [],
  projects: [],
  suggestions: [],
  isLoading: false,
  error: null,
  loadRecentCommands: async () => {
    const recentCommands = await desktopClient.getRecentCommands()
    set({ recentCommands })
  },
  loadMemoryOverview: async () => {
    set({ isLoading: true, error: null })
    try {
      const [overview, recentCommands] = await Promise.all([
        desktopClient.getMemoryOverview(),
        desktopClient.getRecentCommands(),
      ])
      if (!overview) {
        set({ isLoading: false })
        return
      }
      set({
        isLoading: false,
        recentCommands,
        commandStats: overview.commandStats,
        workflows: overview.workflows,
        projects: overview.projects,
        suggestions: overview.suggestions,
      })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load memory overview.',
      })
    }
  },
  runWorkflow: async (workflowId) => {
    const result = await desktopClient.executeWorkflow(workflowId)
    if (!result?.ok) {
      set({ error: result?.message ?? 'Workflow execution failed.' })
      return
    }
    set({ error: null })
  },
}))
