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
      <h3 className="text-lg font-semibold text-white">Activity Logs</h3>
      <p className="mt-2 text-sm text-white/60">Execution logs, command traces, and screen analysis (MVP).</p>
      <div className="mt-4 space-y-2">
        {logs.length === 0 ? (
          <p className="text-sm text-white/40">No execution logs yet.</p>
        ) : (
          logs.slice(0, 24).map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
            >
              <p className="text-sm text-white/80">{log.message}</p>
              <span className="text-xs uppercase text-cyan-300">{log.level}</span>
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
