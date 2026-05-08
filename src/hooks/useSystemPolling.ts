import { useEffect } from 'react'
import { useSystemStore } from '@/store/systemStore'

export function useSystemPolling(intervalMs = 5000) {
  const refreshSnapshot = useSystemStore((state) => state.refreshSnapshot)

  useEffect(() => {
    void refreshSnapshot()
    const interval = window.setInterval(() => {
      void refreshSnapshot()
    }, intervalMs)
    return () => window.clearInterval(interval)
  }, [intervalMs, refreshSnapshot])
}
