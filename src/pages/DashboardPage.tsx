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
  if (state === 'syncing' || state === 'stable') return 'text-amber-300'
  return 'text-amber-300'
}

export function DashboardPage() {
  const dashboard = useAppStore((state) => state.dashboard)
  const snapshot = useSystemStore((state) => state.snapshot)
  const lastError = useSystemStore((state) => state.lastError)
  const liveTasks = useExecutionStore((state) => state.tasks)
  const loadExecutionData = useExecutionStore((state) => state.loadExecutionData)
  const initializeExecutionListener = useExecutionStore((state) => state.initializeExecutionListener)
  const recentCommandsFromMemory = useMemoryStore((state) => state.recentCommands)
  const loadRecentCommands = useMemoryStore((state) => state.loadRecentCommands)
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
          label: 'CPU',
          value: `${snapshot.cpuUsagePercent}%`,
          progress: snapshot.cpuUsagePercent,
        },
        {
          id: 'ram',
          label: 'Memory',
          value: `${snapshot.memoryUsedGb} / ${snapshot.memoryTotalGb} GB`,
          progress: snapshot.memoryUsagePercent,
        },
        {
          id: 'disk',
          label: 'Disk',
          value: `${snapshot.diskUsedGb} / ${snapshot.diskTotalGb} GB`,
          progress: snapshot.diskUsagePercent,
        },
        {
          id: 'gpu',
          label: 'GPU',
          value: snapshot.gpuUsagePercent === null ? '—' : `${snapshot.gpuUsagePercent}%`,
          progress: snapshot.gpuUsagePercent ?? 0,
        },
      ]
    : dashboard.metrics

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <section className="grid gap-4 xl:grid-cols-3">
        <GlassPanel glow className="xl:col-span-2">
          <motion.div
            className="mb-5 flex items-center justify-between"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-400/50">System</p>
              <h3 className="mt-1 text-xl font-medium text-white/95">Status</h3>
            </div>
            <AIOrb size="md" />
          </motion.div>
          <motion.div
            className="grid gap-3 sm:grid-cols-3"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
          >
            {[
              { label: 'AI', value: dashboard.aiHealth },
              { label: 'Automation', value: dashboard.automationStatus },
              { label: 'Voice', value: dashboard.voiceStatus },
            ].map((item) => (
              <motion.div
                key={item.label}
                variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
              >
                <p className="text-[11px] uppercase tracking-wider text-white/40">{item.label}</p>
                <p className={`mt-1.5 text-sm font-medium capitalize ${statusTone(item.value)}`}>
                  {item.value}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </GlassPanel>

        <GlassPanel>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-400/50">Uptime</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-amber-300">
            {snapshot ? formatUptime(snapshot.uptimeSeconds) : dashboard.uptime}
          </p>
          <p className="mt-2 text-sm text-white/45">
            {snapshot
              ? `${snapshot.osPlatform} · ${snapshot.activeProcesses} processes`
              : 'Awaiting system data'}
          </p>
        </GlassPanel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <GlassPanel>
          <h3 className="mb-4 text-base font-medium text-white/90">Resources</h3>
          <div className="space-y-4">
            {liveMetrics.map((metric, i) => (
              <motion.div
                key={metric.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <motion.div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-white/55">{metric.label}</span>
                  <span className="font-mono text-[13px] text-amber-200/90">{metric.value}</span>
                </motion.div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400/90 via-amber-500/80 to-amber-400/75 shadow-[0_0_12px_rgba(200,155,94,0.25)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.progress}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel>
          <h3 className="mb-4 text-base font-medium text-white/90">Tasks</h3>
          <motion.div className="space-y-2">
            {(liveTasks.length > 0 ? liveTasks.slice(0, 6) : dashboard.activeTasks).map((task, i) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm text-white/85">{task.title}</p>
                  <span className="shrink-0 text-[11px] uppercase tracking-wide text-amber-400/80">
                    {task.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </GlassPanel>
      </section>

      <GlassPanel>
        <h3 className="mb-4 text-base font-medium text-white/90">Recent</h3>
        <AnimatePresence>
          <div className="space-y-1.5">
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
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-white/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-2.5 text-sm text-white/75">
                  <TerminalSquare className="h-4 w-4 shrink-0 text-amber-400/70" />
                  <span className="truncate">{entry.command}</span>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-white/35">{entry.time}</span>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      </GlassPanel>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'AI', value: lastError ? 'Degraded' : 'Ready', icon: Bot },
          { label: 'Host', value: snapshot?.hostname ?? '—', icon: Mic },
          { label: 'Processes', value: snapshot ? String(snapshot.activeProcesses) : '—', icon: PlayCircle },
          {
            label: 'Latency',
            value: aiMetrics[0] ? `${aiMetrics[0].latencyMs}ms` : '—',
            icon: Activity,
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <GlassPanel className="flex items-center justify-between !p-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/40">{card.label}</p>
                <p className="mt-1 text-sm font-medium text-white/85">{card.value}</p>
              </div>
              <card.icon className="h-5 w-5 text-amber-400/60" strokeWidth={1.5} />
            </GlassPanel>
          </motion.div>
        ))}
      </section>
    </motion.div>
  )
}
