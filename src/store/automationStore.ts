import { create } from 'zustand'
import type { WorkflowDefinition, WorkflowRunRecord, WorkflowSchedule } from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface AutomationStore {
  workflows: WorkflowDefinition[]
  schedules: WorkflowSchedule[]
  runs: WorkflowRunRecord[]
  isLoading: boolean
  isRunning: boolean
  error: string | null
  generatedPrompt: string
  setGeneratedPrompt: (prompt: string) => void
  loadAutomationData: () => Promise<void>
  executeWorkflow: (workflowId: string) => Promise<void>
  generateWorkflow: () => Promise<void>
}

export const useAutomationStore = create<AutomationStore>((set, get) => ({
  workflows: [],
  schedules: [],
  runs: [],
  isLoading: false,
  isRunning: false,
  error: null,
  generatedPrompt: '',
  setGeneratedPrompt: (generatedPrompt) => set({ generatedPrompt }),
  loadAutomationData: async () => {
    set({ isLoading: true, error: null })
    try {
      const [workflows, schedules, runs] = await Promise.all([
        desktopClient.getWorkflows(),
        desktopClient.getWorkflowSchedules(),
        desktopClient.getWorkflowRuns(),
      ])
      set({ workflows, schedules, runs, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to load automations.' })
    }
  },
  executeWorkflow: async (workflowId) => {
    set({ isRunning: true, error: null })
    const result = await desktopClient.executeWorkflow(workflowId)
    if (!result?.ok) {
      set({ isRunning: false, error: result?.message ?? 'Workflow execution failed.' })
      return
    }
    await get().loadAutomationData()
    set({ isRunning: false })
  },
  generateWorkflow: async () => {
    const prompt = get().generatedPrompt.trim()
    if (!prompt) return
    const workflow = await desktopClient.generateWorkflowFromPrompt(prompt)
    if (!workflow) {
      set({ error: 'Workflow generation failed.' })
      return
    }
    set((state) => ({ workflows: [workflow, ...state.workflows], generatedPrompt: '', error: null }))
  },
}))
