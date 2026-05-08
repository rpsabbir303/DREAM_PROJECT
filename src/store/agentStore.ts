import { create } from 'zustand'
import type { AgentExecutionPlan, AgentRunSummary } from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface AgentStore {
  plans: AgentExecutionPlan[]
  runs: AgentRunSummary[]
  goalInput: string
  isPlanning: boolean
  isExecuting: boolean
  error: string | null
  setGoalInput: (goal: string) => void
  loadAgentData: () => Promise<void>
  planGoal: () => Promise<void>
  executePlan: (planId: string) => Promise<void>
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  plans: [],
  runs: [],
  goalInput: '',
  isPlanning: false,
  isExecuting: false,
  error: null,
  setGoalInput: (goalInput) => set({ goalInput }),
  loadAgentData: async () => {
    const [plans, runs] = await Promise.all([desktopClient.getAgentPlans(), desktopClient.getAgentRuns()])
    set({ plans, runs })
  },
  planGoal: async () => {
    const goal = get().goalInput.trim()
    if (!goal) return
    set({ isPlanning: true, error: null })
    try {
      const plan = await desktopClient.planGoal(goal)
      if (!plan) {
        set({ isPlanning: false, error: 'Plan generation failed.' })
        return
      }
      set((state) => ({ plans: [plan, ...state.plans], goalInput: '', isPlanning: false }))
    } catch (error) {
      set({ isPlanning: false, error: error instanceof Error ? error.message : 'Plan generation failed.' })
    }
  },
  executePlan: async (planId) => {
    set({ isExecuting: true, error: null })
    const result = await desktopClient.executePlan(planId)
    if (!result?.ok) {
      set({ isExecuting: false, error: result?.message ?? 'Execution failed.' })
      return
    }
    await get().loadAgentData()
    set({ isExecuting: false })
  },
}))
