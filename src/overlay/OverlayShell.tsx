import { useEffect } from 'react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { useChatStore } from '@/store/chatStore'
import { useKnowledgeStore } from '@/store/knowledgeStore'
import { useLearningStore } from '@/store/learningStore'
import { useMultiAgentStore } from '@/store/multiAgentStore'
import { useObservabilityStore } from '@/store/observabilityStore'
import { useOverlayStore } from '@/store/overlayStore'
import { useProductivityStore } from '@/store/productivityStore'

export function OverlayShell() {
  const inputValue = useChatStore((state) => state.inputValue)
  const setInputValue = useChatStore((state) => state.setInputValue)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const messages = useChatStore((state) => state.messages)
  const shortcuts = useOverlayStore((state) => state.shortcuts)
  const workspaceContext = useOverlayStore((state) => state.workspaceContext)
  const state = useOverlayStore((state) => state.state)
  const paletteQuery = useOverlayStore((state) => state.paletteQuery)
  const paletteItems = useOverlayStore((state) => state.paletteItems)
  const loadOverlayEnvironment = useOverlayStore((store) => store.loadOverlayEnvironment)
  const searchPalette = useOverlayStore((store) => store.searchPalette)
  const insights = useProductivityStore((state) => state.insights)
  const loadProductivityContext = useProductivityStore((state) => state.loadProductivityContext)
  const indexingStatus = useKnowledgeStore((state) => state.indexingStatus)
  const refreshKnowledgeStatus = useKnowledgeStore((state) => state.refreshStatus)
  const multiAgentSessions = useMultiAgentStore((state) => state.sessions)
  const loadMultiAgentState = useMultiAgentStore((state) => state.loadMultiAgentState)
  const observabilitySnapshot = useObservabilityStore((state) => state.snapshot)
  const loadObservability = useObservabilityStore((state) => state.loadObservability)
  const learningSnapshot = useLearningStore((state) => state.snapshot)
  const loadLearning = useLearningStore((state) => state.loadLearning)

  useEffect(() => {
    void loadOverlayEnvironment()
    void searchPalette('')
    void loadProductivityContext()
    void refreshKnowledgeStatus()
    void loadMultiAgentState()
    void loadObservability()
    void loadLearning()
  }, [
    loadOverlayEnvironment,
    searchPalette,
    loadProductivityContext,
    refreshKnowledgeStatus,
    loadMultiAgentState,
    loadObservability,
    loadLearning,
  ])

  return (
    <div className="min-h-screen bg-transparent p-3 text-white">
      <GlassPanel className="h-[calc(100vh-24px)] border-cyan-300/20 bg-[#070b14]/85 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.14em] text-white/45">JARVIS Overlay</p>
        <p className="mt-1 text-xs text-white/60">
          {workspaceContext ? `${workspaceContext.app} - ${workspaceContext.title}` : 'Workspace context unavailable'}
        </p>
        {insights?.projectContext && (
          <p className="mt-1 text-xs text-white/60">
            Project: {insights.projectContext.projectName} ({insights.projectContext.projectType})
          </p>
        )}
        <p className="mt-1 text-xs text-white/60">Knowledge chunks: {indexingStatus?.indexedChunkCount ?? 0}</p>
        <p className="mt-1 text-xs text-white/60">Active agents: {multiAgentSessions[0]?.selectedAgents.length ?? 0}</p>
        <p className="mt-1 text-xs text-white/60">Active alerts: {observabilitySnapshot?.activeAlerts ?? 0}</p>
        <p className="mt-1 text-xs text-white/60">Adaptive score: {learningSnapshot?.adaptationScore ?? 0}%</p>
        {state && (
          <p className="mt-1 text-xs text-cyan-300">
            Voice: {state.voiceMode ? 'on' : 'off'} | Automation: {state.quickAutomation ? 'on' : 'off'}
          </p>
        )}
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2">
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Ask anything..."
            className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none"
          />
          <button
            onClick={() => void sendMessage(inputValue)}
            className="mt-2 w-full rounded-lg border border-cyan-300/30 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100"
          >
            Send
          </button>
        </div>
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2">
          <input
            value={paletteQuery}
            onChange={(event) => void searchPalette(event.target.value)}
            placeholder="Command palette..."
            className="h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none"
          />
          <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
            {paletteItems.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
                <p className="text-xs text-white/85">{item.label}</p>
                <p className="text-[10px] text-white/45">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Recent Assistant Output</p>
          <p className="mt-1 text-xs text-white/75">{messages.at(-1)?.content ?? 'No conversation yet.'}</p>
        </div>
        {shortcuts && (
          <p className="mt-3 text-[10px] text-white/50">
            {shortcuts.toggleOverlay} | {shortcuts.toggleVoice} | {shortcuts.quickAutomation}
          </p>
        )}
      </GlassPanel>
    </div>
  )
}
