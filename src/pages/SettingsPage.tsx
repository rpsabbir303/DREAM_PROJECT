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
  const updateAiSettings = useSettingsStore((state) => state.updateAiSettings)
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
      <h3 className="text-lg font-semibold text-white">Settings</h3>
      <p className="mt-2 text-sm text-white/60">
        MVP: AI provider, overlay shortcuts, and command-history search. Set API keys in the project root `.env`
        (OpenAI and/or Gemini).
      </p>
      {isLoadingAi && <p className="mt-2 text-xs text-cyan-300">Loading AI provider settings...</p>}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {aiSettings && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">AI Provider Routing</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <select
                value={aiSettings.preferredProvider}
                onChange={(event) =>
                  void updateAiSettings({ preferredProvider: event.target.value as 'openai' | 'ollama' })
                }
                className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white"
              >
                <option value="ollama">Local (Ollama)</option>
                <option value="openai">Cloud (OpenAI)</option>
              </select>
              <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white">
                Offline mode
                <input
                  type="checkbox"
                  checked={aiSettings.offlineMode}
                  onChange={(event) => void updateAiSettings({ offlineMode: event.target.checked })}
                />
              </label>
              <input
                value={aiSettings.localModel}
                onChange={(event) => void updateAiSettings({ localModel: event.target.value })}
                placeholder="Local model (llama3)"
                className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white"
              />
              <input
                value={aiSettings.cloudModel}
                onChange={(event) => void updateAiSettings({ cloudModel: event.target.value })}
                placeholder="Cloud model (gpt-4o-mini)"
                className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white"
              />
            </div>
            <p className="mt-2 text-xs text-white/60">
              Cloud: {offlineStatus?.online ? 'OpenAI or Gemini key OK' : 'no cloud key'} | Gemini:{' '}
              {offlineStatus?.geminiConfigured ? 'configured' : 'not configured'} | Ollama:{' '}
              {offlineStatus?.ollamaReachable ? 'reachable' : 'not reachable'}
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
                className="rounded-lg border border-cyan-300/30 bg-cyan-500/20 px-3 text-xs text-cyan-200 hover:bg-cyan-500/30"
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
