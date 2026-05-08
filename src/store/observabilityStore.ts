import { create } from 'zustand'
import type { ObservabilityEvent, ObservabilitySnapshot, ProactiveNotification } from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface ObservabilityStore {
  events: ObservabilityEvent[]
  notifications: ProactiveNotification[]
  snapshot: ObservabilitySnapshot | null
  isLoading: boolean
  error: string | null
  loadObservability: () => Promise<void>
  markNotificationRead: (notificationId: string) => Promise<void>
}

export const useObservabilityStore = create<ObservabilityStore>((set, get) => ({
  events: [],
  notifications: [],
  snapshot: null,
  isLoading: false,
  error: null,
  loadObservability: async () => {
    set({ isLoading: true, error: null })
    try {
      const [events, notifications, snapshot] = await Promise.all([
        desktopClient.getObservabilityEvents(),
        desktopClient.getObservabilityNotifications(),
        desktopClient.getObservabilitySnapshot(),
      ])
      set({
        events,
        notifications,
        snapshot,
        isLoading: false,
      })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load observability timeline.',
      })
    }
  },
  markNotificationRead: async (notificationId) => {
    await desktopClient.markObservabilityNotificationRead(notificationId)
    await get().loadObservability()
  },
}))
