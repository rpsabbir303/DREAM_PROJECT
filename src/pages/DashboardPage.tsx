import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, Bot, Mic, PlayCircle, TerminalSquare } from 'lucide-react'
import { AIOrb } from '@/components/assistant/AIOrb'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { useSystemPolling } from '@/hooks/useSystemPolling'
import { useAppStore } from '@/store/appStore'
import { useExecutionStore } from '@/store/executionStore'
import { useMemoryStore } from '@/store/memoryStore'
import { useScreenStore } from '@/store/screenStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useSystemStore } from '@/store/systemStore'
import { formatUptime } from '@/utils/formatUptime'

function statusTone(state: string) {
  if (state === 'online' || state === 'optimal') return 'text-emerald-300'
  if (state === 'syncing' || state === 'stable') return 'text-cyan-300'
  return 'text-amber-300'
}

/** MVP dashboard: system health, tasks, command history, and AI provider status (same layout shell). */
export function DashboardPage() {
  const dashboard = useAppStore((state) => state.dashboard)
  const snapshot = useSystemStore((state) => state.snapshot)
  const isLoading = useSystemStore((state) => state.isLoading)
  const lastError = useSystemStore((state) => state.lastError)
  const liveTasks = useExecutionStore((state) => state.tasks)
  const loadExecutionData = useExecutionStore((state) => state.loadExecutionData)
  const initializeExecutionListener = useExecutionStore((state) => state.initializeExecutionListener)
  const recentCommandsFromMemory = useMemoryStore((state) => state.recentCommands)
  const loadRecentCommands = useMemoryStore((state) => state.loadRecentCommands)
  const activeWindow = useScreenStore((state) => state.activeWindow)
  const latestAnalysis = useScreenStore((state) => state.latestAnalysis)
  const refreshActiveWindow = useScreenStore((state) => state.refreshActiveWindow)
  const loadScreenHistory = useScreenStore((state) => state.loadHistory)
  const aiMetrics = useSettingsStore((state) => state.aiMetrics)
  const loadAiSettings = useSettingsStore((state) => state.loadAiSettings)
  useSystemPolling(5000)

  useEffect(() => {
    initializeExecutionListener()
    void loadExecutionData()
    void loadRecentCommands()
    void refreshActiveWindow()
    void loadScreenHistory()
    void loadAiSettings()
  }, [
    initializeExecutionListener,
    loadExecutionData,
    loadRecentCommands,
    refreshActiveWindow,
    loadScreenHistory,
    loadAiSettings,
  ])

  const liveMetrics = snapshot
    ? [
        {
          id: 'cpu',
          label: 'CPU Load',
          value: `${snapshot.cpuUsagePercent}%`,
          progress: snapshot.cpuUsagePercent,
        },
        {
          id: 'ram',
          label: 'RAM',
          value: `${snapshot.memoryUsedGb} GB / ${snapshot.memoryTotalGb} GB`,
          progress: snapshot.memoryUsagePercent,
        },
        {
          id: 'disk',
          label: 'Disk',
          value: `${snapshot.diskUsedGb} GB / ${snapshot.diskTotalGb} GB`,
          progress: snapshot.diskUsagePercent,
        },
        {
          id: 'gpu',
          label: 'GPU',
          value: snapshot.gpuUsagePercent === null ? 'Unavailable' : `${snapshot.gpuUsagePercent}%`,
          progress: snapshot.gpuUsagePercent ?? 0,
        },
      ]
    : dashboard.metrics

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-3">
        <GlassPanel className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">AI Status</p>
              <h3 className="text-lg font-semibold text-white">JARVIS MVP</h3>
            </div>
            <AIOrb size="md" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/45">Health</p>
              <p className={`mt-1 text-sm font-semibold capitalize ${statusTone(dashboard.aiHealth)}`}>
                {dashboard.aiHealth}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/45">Automation</p>
              <p
                className={`mt-1 text-sm font-semibold capitalize ${statusTone(
                  dashboard.automationStatus,
                )}`}
              >
                {dashboard.automationStatus}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/45">Voice Assistant</p>
              <p className="mt-1 text-sm font-semibold capitalize text-cyan-300">
                {dashboard.voiceStatus}
              </p>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel>
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Uptime</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-300">
            {snapshot ? formatUptime(snapshot.uptimeSeconds) : dashboard.uptime}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {snapshot
              ? `${snapshot.osPlatform} ${snapshot.osRelease} · ${snapshot.activeProcesses} processes`
              : 'MVP build — chat, voice, commands, and workflows.'}
          </p>
        </GlassPanel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <GlassPanel>
          <h3 className="mb-3 text-base font-semibold text-white">System Overview</h3>
          <div className="space-y-3">
            {liveMetrics.map((metric) => (
              <div key={metric.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-white/70">{metric.label}</span>
                  <span className="text-cyan-200">{metric.value}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.progress}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel>
          <h3 className="mb-3 text-base font-semibold text-white">Active Tasks</h3>
          <div className="space-y-2">
            {(liveTasks.length > 0 ? liveTasks.slice(0, 6) : dashboard.activeTasks).map((task) => (
              <div key={task.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{task.title}</p>
                  <span className="text-xs text-cyan-300 uppercase">{task.status}</span>
                </div>
                <p className="mt-1 text-xs text-white/55">
                  {'command' in task ? task.command : task.intent}
                </p>
                <p className="mt-2 text-xs text-white/40">
                  {'eta' in task ? `ETA: ${task.eta}` : `Updated: ${new Date(task.updatedAt).toLocaleTimeString()}`}
                </p>
              </div>
            ))}
          </div>
        </GlassPanel>
      </section>

      <section>
        <GlassPanel>
          <h3 className="mb-3 text-base font-semibold text-white">Recent Commands</h3>
          <AnimatePresence>
            <div className="space-y-2">
              {(recentCommandsFromMemory.length > 0
                ? recentCommandsFromMemory.slice(0, 6).map((item) => ({
                    id: item.id,
                    command: item.command,
                    time: new Date(item.createdAt).toLocaleTimeString(),
                  }))
                : dashboard.recentCommands
              ).map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <TerminalSquare className="h-4 w-4 text-cyan-300" />
                    {entry.command}
                  </div>
                  <span className="text-xs text-white/50">{entry.time}</span>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        </GlassPanel>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'AI Status', value: lastError ? 'Degraded' : 'Ready', icon: Bot },
          { label: 'Voice', value: snapshot ? snapshot.hostname : 'Standby', icon: Mic },
          { label: 'Automation', value: snapshot ? `${snapshot.activeProcesses} procs` : '—', icon: PlayCircle },
          {
            label: 'Screen',
            value: latestAnalysis ? latestAnalysis.summary.slice(0, 22) : isLoading ? 'Refreshing' : 'Idle',
            icon: Activity,
          },
          {
            label: 'AI Provider',
            value: aiMetrics[0] ? `${aiMetrics[0].provider}:${aiMetrics[0].latencyMs}ms` : 'No data',
            icon: Activity,
          },
          { label: 'MVP scope', value: 'Chat · Exec · Voice', icon: Bot },
          { label: 'Workflows', value: 'Scheduler on', icon: PlayCircle },
          { label: 'Memory', value: 'SQLite logs', icon: Activity },
          { label: 'Advanced AI', value: 'Disabled', icon: Bot },
          { label: 'Observability', value: 'N/A', icon: Activity },
        ].map((card) => (
          <GlassPanel key={card.label} className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50">{card.label}</p>
              <p className="mt-1 text-sm font-semibold text-white">{card.value}</p>
            </div>
            <card.icon className="h-5 w-5 text-cyan-300" />
          </GlassPanel>
        ))}
      </section>
      {activeWindow && (
        <GlassPanel>
          <p className="text-xs text-white/50">Active Window Context</p>
          <p className="mt-1 text-sm text-white/85">
            {activeWindow.app} — {activeWindow.title}
          </p>
        </GlassPanel>
      )}
    </div>
  )
}
