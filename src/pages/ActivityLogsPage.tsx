import { useEffect } from 'react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { useExecutionStore } from '@/store/executionStore'
import { useMemoryStore } from '@/store/memoryStore'
import { useScreenStore } from '@/store/screenStore'

export function ActivityLogsPage() {
  const logs = useExecutionStore((state) => state.logs)
  const loadExecutionData = useExecutionStore((state) => state.loadExecutionData)
  const initializeExecutionListener = useExecutionStore((state) => state.initializeExecutionListener)
  const suggestions = useMemoryStore((state) => state.suggestions)
  const loadMemoryOverview = useMemoryStore((state) => state.loadMemoryOverview)
  const screenHistory = useScreenStore((state) => state.history)
  const loadScreenHistory = useScreenStore((state) => state.loadHistory)

  useEffect(() => {
    initializeExecutionListener()
    void loadExecutionData()
    void loadMemoryOverview()
    void loadScreenHistory()
  }, [initializeExecutionListener, loadExecutionData, loadMemoryOverview, loadScreenHistory])

  return (
    <GlassPanel className="min-h-[70vh]">
      <h3 className="text-lg font-medium tracking-tight text-white/95">Logs</h3>
      <div className="mt-4 space-y-2">
        {logs.length === 0 ? (
          <p className="text-sm text-white/40">No execution logs yet.</p>
        ) : (
          logs.slice(0, 24).map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:bg-white/[0.04]"
            >
              <p className="text-sm text-white/80">{log.message}</p>
              <span className="text-xs uppercase text-amber-300">{log.level}</span>
            </div>
          ))
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Personalization Notes</p>
          <div className="mt-2 space-y-1">
            {suggestions.slice(0, 4).map((item) => (
              <p key={item.id} className="text-sm text-white/75">
                {item.message}
              </p>
            ))}
          </div>
        </div>
      )}
      {screenHistory.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Screen Analysis History</p>
          <div className="mt-2 space-y-1">
            {screenHistory.slice(0, 5).map((entry) => (
              <p key={entry.id} className="text-sm text-white/75">
                {entry.summary}
              </p>
            ))}
          </div>
        </div>
      )}
    </GlassPanel>
  )
}
