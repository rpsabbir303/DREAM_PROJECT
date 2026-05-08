import { create } from 'zustand'
import type { AgentPerformanceMetric, MultiAgentSession } from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface MultiAgentStore {
  sessions: MultiAgentSession[]
  performance: AgentPerformanceMetric[]
  goalInput: string
  isRunning: boolean
  error: string | null
  setGoalInput: (value: string) => void
  loadMultiAgentState: () => Promise<void>
  runGoal: () => Promise<void>
}

export const useMultiAgentStore = create<MultiAgentStore>((set, get) => ({
  sessions: [],
  performance: [],
  goalInput: '',
  isRunning: false,
  error: null,
  setGoalInput: (goalInput) => set({ goalInput }),
  loadMultiAgentState: async () => {
    const [sessions, performance] = await Promise.all([
      desktopClient.getMultiAgentSessions(),
      desktopClient.getMultiAgentPerformance(),
    ])
    set({ sessions, performance })
  },
  runGoal: async () => {
    const goal = get().goalInput.trim()
    if (!goal) return
    set({ isRunning: true, error: null })
    const session = await desktopClient.runMultiAgentTask(goal)
    if (!session) {
      set({ isRunning: false, error: 'Multi-agent execution failed.' })
      return
    }
    await get().loadMultiAgentState()
    set({ goalInput: '', isRunning: false })
  },
}))
