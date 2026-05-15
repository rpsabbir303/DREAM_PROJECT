import { useEffect, useMemo, useState } from 'react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { useOverlayStore } from '@/store/overlayStore'
import { useSettingsStore } from '@/store/settingsStore'

export function SettingsPage() {
  const aiSettings = useSettingsStore((state) => state.aiSettings)
  const aiModels = useSettingsStore((state) => state.aiModels)
  const aiMetrics = useSettingsStore((state) => state.aiMetrics)
  const offlineStatus = useSettingsStore((state) => state.offlineStatus)
  const semanticHits = useSettingsStore((state) => state.semanticHits)
  const isLoadingAi = useSettingsStore((state) => state.isLoadingAi)
  const error = useSettingsStore((state) => state.error)
  const loadAiSettings = useSettingsStore((state) => state.loadAiSettings)
  const searchSemanticMemory = useSettingsStore((state) => state.searchSemanticMemory)
  const overlayState = useOverlayStore((state) => state.state)
  const shortcutBindings = useOverlayStore((state) => state.shortcuts)
  const workspaceContext = useOverlayStore((state) => state.workspaceContext)
  const loadOverlayEnvironment = useOverlayStore((state) => state.loadOverlayEnvironment)
  const setVisible = useOverlayStore((state) => state.setVisible)
  const setDocked = useOverlayStore((state) => state.setDocked)
  const setVoiceMode = useOverlayStore((state) => state.setVoiceMode)
  const setQuickAutomation = useOverlayStore((state) => state.setQuickAutomation)
  const updateShortcuts = useOverlayStore((state) => state.updateShortcuts)
  const [semanticQuery, setSemanticQuery] = useState('')

  useEffect(() => {
    void loadAiSettings()
    void loadOverlayEnvironment()
  }, [loadAiSettings, loadOverlayEnvironment])

  const avgLatency = useMemo(() => {
    if (aiMetrics.length === 0) return null
    return Math.round(aiMetrics.reduce((sum, item) => sum + item.latencyMs, 0) / aiMetrics.length)
  }, [aiMetrics])

  return (
    <GlassPanel className="min-h-[70vh]">
      <h3 className="text-lg font-medium tracking-tight text-white/95">Settings</h3>
      <p className="mt-2 text-sm text-white/45">
        Configure Gemini via <code className="rounded bg-white/[0.06] px-1 text-amber-200/80">GEMINI_API_KEY</code> in{' '}
        <code className="rounded bg-white/[0.06] px-1 text-white/60">.env</code>
      </p>
      {isLoadingAi && <p className="mt-2 text-xs text-amber-300">Loading AI provider settings...</p>}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {aiSettings && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">AI (Google Gemini)</p>
            <p className="mt-2 text-sm text-white/80">
              Provider: Gemini only — model <span className="text-amber-200">{offlineStatus?.activeModel ?? '—'}</span>
            </p>
            <p className="mt-2 text-xs text-white/60">
              Key: {offlineStatus?.geminiConfigured ? 'GEMINI_API_KEY OK' : 'not configured or placeholder'} | Cloud ready:{' '}
              {offlineStatus?.online ? 'yes' : 'no'}
            </p>
            <p className="mt-2 text-xs text-white/50">
              Model id comes from <code className="text-white/70">GEMINI_MODEL</code> in the project root <code className="text-white/70">.env</code> (see Google AI Studio). Current:{' '}
              <code className="text-amber-200/90">{offlineStatus?.activeModel ?? '—'}</code>
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">Local Models</p>
            <div className="mt-2 space-y-1">
              {aiModels.slice(0, 8).map((model) => (
                <p key={`${model.provider}-${model.name}`} className="text-sm text-white/75">
                  {model.name} ({model.provider}) - {model.available ? 'available' : 'install needed'}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">Command history search</p>
            <p className="mt-1 text-xs text-white/50">MVP: substring match on recent shell commands (no vector DB).</p>
            <div className="mt-2 flex gap-2">
              <input
                value={semanticQuery}
                onChange={(event) => setSemanticQuery(event.target.value)}
                placeholder="Filter commands…"
                className="h-10 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white"
              />
              <button
                onClick={() => void searchSemanticMemory(semanticQuery)}
                className="rounded-lg border border-amber-300/30 bg-amber-500/20 px-3 text-xs text-amber-200 hover:bg-amber-500/30"
              >
                Search
              </button>
            </div>
            <div className="mt-2 space-y-1">
              {semanticHits.slice(0, 5).map((hit) => (
                <p key={hit.id} className="text-sm text-white/75">
                  [{hit.kind}] {hit.content}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">AI Performance</p>
            <p className="mt-2 text-sm text-white/75">
              Recent requests: {aiMetrics.length} {avgLatency !== null ? `| Avg latency: ${avgLatency}ms` : ''}
            </p>
          </div>
          {overlayState && (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-white/45">Global Overlay Environment</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white">
                  Overlay visible
                  <input
                    type="checkbox"
                    checked={overlayState.visible}
                    onChange={(event) => void setVisible(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white">
                  Always docked
                  <input
                    type="checkbox"
                    checked={overlayState.docked}
                    onChange={(event) => void setDocked(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white">
                  Voice shortcut mode
                  <input
                    type="checkbox"
                    checked={overlayState.voiceMode}
                    onChange={(event) => void setVoiceMode(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white">
                  Quick automation mode
                  <input
                    type="checkbox"
                    checked={overlayState.quickAutomation}
                    onChange={(event) => void setQuickAutomation(event.target.checked)}
                  />
                </label>
              </div>
              {shortcutBindings && (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <input
                    value={shortcutBindings.toggleOverlay}
                    onChange={(event) => void updateShortcuts({ toggleOverlay: event.target.value })}
                    className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white"
                  />
                  <input
                    value={shortcutBindings.toggleVoice}
                    onChange={(event) => void updateShortcuts({ toggleVoice: event.target.value })}
                    className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white"
                  />
                  <input
                    value={shortcutBindings.quickAutomation}
                    onChange={(event) => void updateShortcuts({ quickAutomation: event.target.value })}
                    className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white"
                  />
                </div>
              )}
              <p className="mt-2 text-xs text-white/60">
                Workspace: {workspaceContext ? `${workspaceContext.app} - ${workspaceContext.title}` : 'No context'}
              </p>
            </div>
          )}
        </div>
      )}
    </GlassPanel>
  )
}
