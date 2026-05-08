import { create } from 'zustand'
import type { ActivityLogRecord, AssistantTask, ChatStreamEvent, TaskStatus } from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface ExecutionStore {
  tasks: AssistantTask[]
  logs: ActivityLogRecord[]
  initialized: boolean
  loadExecutionData: () => Promise<void>
  initializeExecutionListener: () => void
}

function upsertTask(tasks: AssistantTask[], incoming: AssistantTask) {
  const index = tasks.findIndex((task) => task.id === incoming.id)
  if (index === -1) return [incoming, ...tasks]
  const updated = [...tasks]
  updated[index] = incoming
  return updated
}

function updateTaskStatus(tasks: AssistantTask[], taskId: string, status: TaskStatus) {
  return tasks.map((task) =>
    task.id === taskId ? { ...task, status, updatedAt: new Date().toISOString() } : task,
  )
}

export const useExecutionStore = create<ExecutionStore>((set, get) => ({
  tasks: [],
  logs: [],
  initialized: false,
  loadExecutionData: async () => {
    const [tasks, logs] = await Promise.all([
      desktopClient.getRecentTasks(),
      desktopClient.getRecentExecutionLogs(),
    ])
    set({ tasks, logs })
  },
  initializeExecutionListener: () => {
    if (get().initialized) return

    desktopClient.onChatStreamEvent((event: ChatStreamEvent) => {
      if (event.type === 'task') {
        set((state) => ({ tasks: upsertTask(state.tasks, event.data) }))
        return
      }
      if (event.type === 'task-status') {
        set((state) => ({
          tasks: updateTaskStatus(state.tasks, event.data.taskId, event.data.status),
        }))
        return
      }
      if (event.type === 'execution') {
        const level: ActivityLogRecord['level'] = event.data.ok ? 'info' : 'error'
        set((state) => ({
          logs: [
            {
              id: crypto.randomUUID(),
              level,
              message: event.data.message,
              createdAt: new Date().toISOString(),
            },
            ...state.logs,
          ].slice(0, 120),
        }))
      }
    })
    set({ initialized: true })
  },
}))
