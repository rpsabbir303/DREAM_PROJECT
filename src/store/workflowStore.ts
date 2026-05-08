import { create } from 'zustand'
import type { WorkflowDefinition } from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface WorkflowStore {
  workflows: WorkflowDefinition[]
  isRunning: boolean
  error: string | null
  loadWorkflows: () => Promise<void>
  executeWorkflow: (id: string) => Promise<void>
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  workflows: [],
  isRunning: false,
  error: null,
  loadWorkflows: async () => {
    const workflows = await desktopClient.getWorkflows()
    set({ workflows })
  },
  executeWorkflow: async (id) => {
    set({ isRunning: true, error: null })
    const result = await desktopClient.executeWorkflow(id)
    set({ isRunning: false })
    if (!result?.ok) {
      set({ error: result?.message ?? 'Workflow execution failed.' })
    }
  },
}))
