import { create } from 'zustand'

export type TaskExecutionState = 'idle' | 'pending' | 'validating' | 'running' | 'completed' | 'failed'

interface TaskStore {
  activeTaskCount: number
  executionState: TaskExecutionState
  setExecutionState: (state: TaskExecutionState) => void
}

export const useTaskStore = create<TaskStore>((set) => ({
  activeTaskCount: 0,
  executionState: 'idle',
  setExecutionState: (executionState) => set({ executionState }),
}))
