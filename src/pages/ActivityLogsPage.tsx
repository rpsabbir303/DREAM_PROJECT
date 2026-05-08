import { useEffect } from 'react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { useAgentStore } from '@/store/agentStore'
import { useExecutionStore } from '@/store/executionStore'
import { useMemoryStore } from '@/store/memoryStore'
import { useMultiAgentStore } from '@/store/multiAgentStore'
import { useObservabilityStore } from '@/store/observabilityStore'
import { useScreenStore } from '@/store/screenStore'

export function ActivityLogsPage() {
  const logs = useExecutionStore((state) => state.logs)
  const loadExecutionData = useExecutionStore((state) => state.loadExecutionData)
  const initializeExecutionListener = useExecutionStore((state) => state.initializeExecutionListener)
  const suggestions = useMemoryStore((state) => state.suggestions)
  const loadMemoryOverview = useMemoryStore((state) => state.loadMemoryOverview)
  const screenHistory = useScreenStore((state) => state.history)
  const loadScreenHistory = useScreenStore((state) => state.loadHistory)
  const agentRuns = useAgentStore((state) => state.runs)
  const loadAgentData = useAgentStore((state) => state.loadAgentData)
  const multiAgentSessions = useMultiAgentStore((state) => state.sessions)
  const loadMultiAgentState = useMultiAgentStore((state) => state.loadMultiAgentState)
  const events = useObservabilityStore((state) => state.events)
  const notifications = useObservabilityStore((state) => state.notifications)
  const loadObservability = useObservabilityStore((state) => state.loadObservability)
  const markNotificationRead = useObservabilityStore((state) => state.markNotificationRead)

  useEffect(() => {
    initializeExecutionListener()
    void loadExecutionData()
    void loadMemoryOverview()
    void loadScreenHistory()
    void loadAgentData()
    void loadMultiAgentState()
    void loadObservability()
  }, [
    initializeExecutionListener,
    loadExecutionData,
    loadMemoryOverview,
    loadScreenHistory,
    loadAgentData,
    loadMultiAgentState,
    loadObservability,
  ])

  return (
    <GlassPanel className="min-h-[70vh]">
      <h3 className="text-lg font-semibold text-white">Activity Logs</h3>
      <p className="mt-2 text-sm text-white/60">System logs, command traces, errors, and security events.</p>
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
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">AI Personalization Notes</p>
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
      {agentRuns.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Agent Orchestration History</p>
          <div className="mt-2 space-y-1">
            {agentRuns.slice(0, 6).map((entry) => (
              <p key={entry.id} className="text-sm text-white/75">
                {entry.state.toUpperCase()} - {entry.goal}
              </p>
            ))}
          </div>
        </div>
      )}
      {multiAgentSessions.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Multi-Agent Collaboration History</p>
          <div className="mt-2 space-y-1">
            {multiAgentSessions.slice(0, 5).map((session) => (
              <p key={session.id} className="text-sm text-white/75">
                {session.status.toUpperCase()} - {session.goal}
              </p>
            ))}
          </div>
        </div>
      )}
      {events.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Live Event Timeline</p>
          <div className="mt-2 space-y-1">
            {events.slice(0, 8).map((event) => (
              <p key={event.id} className="text-sm text-white/75">
                {event.type.toUpperCase()} - {event.title}
              </p>
            ))}
          </div>
        </div>
      )}
      {notifications.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Proactive Notifications</p>
          <div className="mt-2 space-y-2">
            {notifications.slice(0, 6).map((notification) => (
              <button
                key={notification.id}
                onClick={() => void markNotificationRead(notification.id)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-left"
              >
                <p className="text-sm text-white/80">{notification.title}</p>
                <p className="text-xs text-white/55">{notification.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </GlassPanel>
  )
}
