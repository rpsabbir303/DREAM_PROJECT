import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Cpu, LoaderCircle, Mic, ScanSearch, Send, Square, User, Volume2, VolumeX } from 'lucide-react'
import { ChatAssistantMarkdown } from '@/components/chat/ChatAssistantMarkdown'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { jarvisThinkingLabel } from '@/lib/jarvisChatUx'
import { useChatStore } from '@/store/chatStore'
import { useScreenStore } from '@/store/screenStore'
import { useVoiceStore, VOICE_INPUT_ENABLED } from '@/store/voiceStore'

export function ChatPage() {
  const messages = useChatStore((state) => state.messages)
  const tasks = useChatStore((state) => state.tasks)
  const inputValue = useChatStore((state) => state.inputValue)
  const isThinking = useChatStore((state) => state.isThinking)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const latestUnderstanding = useChatStore((state) => state.latestUnderstanding)
  const providerDecision = useChatStore((state) => state.providerDecision)
  const error = useChatStore((state) => state.error)
  const lastExecution = useChatStore((state) => state.lastExecution)
  const recentToolSteps = useChatStore((state) => state.recentToolSteps)
  const activeStreamId = useChatStore((state) => state.activeStreamId)
  const setInputValue = useChatStore((state) => state.setInputValue)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const initializeStreamListener = useChatStore((state) => state.initializeStreamListener)
  const isListening = useVoiceStore((state) => state.isListening)
  const isSpeaking = useVoiceStore((state) => state.isSpeaking)
  const isTranscribing = useVoiceStore((state) => state.isTranscribing)
  const voiceError = useVoiceStore((state) => state.error)
  const transcriptionText = useVoiceStore((state) => state.transcriptionText)
  const startListening = useVoiceStore((state) => state.startListening)
  const stopListening = useVoiceStore((state) => state.stopListening)
  const stopSpeakingNow = useVoiceStore((state) => state.stopSpeakingNow)
  const initializeVoiceListener = useVoiceStore((state) => state.initializeVoiceListener)
  const latestAnalysis = useScreenStore((state) => state.latestAnalysis)
  const activeWindow = useScreenStore((state) => state.activeWindow)
  const isCapturing = useScreenStore((state) => state.isCapturing)
  const isAnalyzing = useScreenStore((state) => state.isAnalyzing)
  const screenError = useScreenStore((state) => state.error)
  const captureScreen = useScreenStore((state) => state.captureScreen)
  const analyzeScreen = useScreenStore((state) => state.analyzeScreen)
  const refreshActiveWindow = useScreenStore((state) => state.refreshActiveWindow)

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    initializeVoiceListener()
    initializeStreamListener()
    void refreshActiveWindow()
  }, [initializeStreamListener, initializeVoiceListener, refreshActiveWindow])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: isStreaming || isThinking ? 'auto' : 'smooth' })
  }, [messages, isStreaming, isThinking])

  return (
    <GlassPanel className="grid min-h-[70vh] grid-rows-[1fr_auto] gap-4">
      <div ref={scrollRef} className="space-y-3 overflow-y-auto pr-1 scroll-smooth">
        <h3 className="text-lg font-semibold tracking-tight text-white">JARVIS</h3>
        <p className="text-sm text-white/55">
          Desktop copilot — concise answers, full context when it matters.
        </p>

        {latestUnderstanding && (
          <motion.div
            layout
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs text-cyan-100"
          >
            <p>
              Intent: <span className="font-semibold">{latestUnderstanding.intent}</span>
              {latestUnderstanding.target ? ` | Target: ${latestUnderstanding.target}` : ''}
            </p>
            {latestUnderstanding.goalSummary && (
              <p className="mt-1 text-cyan-50/90">Goal: {latestUnderstanding.goalSummary}</p>
            )}
            {(latestUnderstanding.ambiguity || latestUnderstanding.riskLevel) && (
              <p className="mt-1 text-white/55">
                Signals — ambiguity: {latestUnderstanding.ambiguity ?? 'n/a'} · risk:{' '}
                {latestUnderstanding.riskLevel ?? 'n/a'}
                {latestUnderstanding.executionConfidence !== undefined && (
                  <> · exec confidence: {latestUnderstanding.executionConfidence.toFixed(2)}</>
                )}
                {latestUnderstanding.continuityHint ?
                  <>
                    {' '}
                    · continuity: <span className="text-cyan-200/90">{latestUnderstanding.continuityHint}</span>
                  </>
                : null}
              </p>
            )}
            {latestUnderstanding.decisionSummary && (
              <p className="mt-1 border-t border-cyan-400/15 pt-1 text-[11px] text-cyan-100/85">
                Decision: {latestUnderstanding.decisionSummary}
              </p>
            )}
          </motion.div>
        )}
        {providerDecision && (
          <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-cyan-100">
            Provider: <span className="font-semibold uppercase">{providerDecision.provider}</span> (
            {providerDecision.model}) {providerDecision.isOffline ? '| Offline mode' : ''}
          </div>
        )}

        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const isAssistant = message.role === 'assistant'
              const isLatest = index === messages.length - 1
              return (
                <motion.div
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={
                    isAssistant ?
                      { type: 'spring', stiffness: 380, damping: 34, mass: 0.85 }
                    : { type: 'spring', stiffness: 460, damping: 36 }
                  }
                  className={
                    isAssistant ?
                      'flex items-start gap-3 rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/30 via-black/35 to-black/45 p-3.5 shadow-[0_0_28px_-14px_rgba(34,211,238,0.4)]'
                    : 'flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5'
                  }
                >
                  {message.role === 'user' ? (
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-white/65" />
                  ) : (
                    <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300/90" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    {isAssistant && (
                      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
                        JARVIS
                      </p>
                    )}
                    <motion.div
                      key={isLatest && isAssistant ? `${message.id}-${message.content.length}` : message.id}
                      initial={isAssistant && isLatest ? { opacity: 0.88 } : false}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="text-sm text-white/85"
                    >
                      {isAssistant ? (
                        <ChatAssistantMarkdown content={message.content} />
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content || '…'}</p>
                      )}
                    </motion.div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {lastExecution && (
          <motion.div
            layout
            key={`${lastExecution.actionType}-${lastExecution.ok}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={`rounded-xl border p-3 text-xs ${
              lastExecution.ok ?
                'border-emerald-400/25 bg-emerald-500/10 text-emerald-50'
              : 'border-amber-400/30 bg-amber-500/10 text-amber-50'
            }`}
          >
            <p className="font-semibold uppercase tracking-wide text-white/50">Last execution</p>
            <p className="mt-1 text-white/90">
              {lastExecution.ok ? 'Success' : 'Issue'} — {lastExecution.message}
            </p>
            {!lastExecution.ok && lastExecution.recoveryHint && (
              <p className="mt-2 border-t border-white/10 pt-2 text-white/80">Tip: {lastExecution.recoveryHint}</p>
            )}
          </motion.div>
        )}
        {recentToolSteps.length > 0 && (
          <div className="flex flex-wrap gap-2 text-[11px] text-cyan-100/90">
            {recentToolSteps.map((step, index) => (
              <span
                key={`${step.name}-${index}`}
                className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2 py-1"
              >
                {step.name} {step.ok ? '✓' : '✗'} — {step.summary.slice(0, 80)}
                {step.summary.length > 80 ? '…' : ''}
              </span>
            ))}
          </div>
        )}

        {tasks.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">Generated Tasks</p>
            <div className="mt-2 space-y-2">
              {tasks.slice(0, 4).map((task) => (
                <div key={task.id} className="flex items-center justify-between text-xs text-white/80">
                  <span>{task.title}</span>
                  <span className="uppercase text-cyan-300">{task.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(isThinking || isStreaming) && (
          <motion.div
            layout
            className="flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.07] px-3 py-2 text-xs text-cyan-200/95"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <motion.span
              animate={{ opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex"
            >
              <LoaderCircle className="h-4 w-4 animate-spin text-cyan-300" />
            </motion.span>
            <span className="font-mono tracking-wide">{jarvisThinkingLabel(activeStreamId, isStreaming)}</span>
          </motion.div>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}
        {voiceError && <p className="text-sm text-red-300">{voiceError}</p>}
        {screenError && <p className="text-sm text-red-300">{screenError}</p>}
        {transcriptionText && (
          <p className="text-xs text-cyan-200/80">Last voice transcript: "{transcriptionText}"</p>
        )}
        {activeWindow && (
          <p className="text-xs text-cyan-200/80">
            Active window: {activeWindow.app} — {activeWindow.title}
          </p>
        )}
        {latestAnalysis && (
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
            Screen Summary: {latestAnalysis.summary}
          </div>
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = inputValue.trim()
          console.info('[JARVIS_UI] send (submit), chars=', trimmed.length)
          void sendMessage(inputValue)
        }}
      >
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Command JARVIS…"
          className="h-11 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none ring-cyan-400/30 placeholder:text-white/40 focus:ring-2"
        />
        <button
          type="submit"
          className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-500/20 text-cyan-200 transition hover:bg-cyan-500/30"
        >
          <Send className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!VOICE_INPUT_ENABLED}
          title={VOICE_INPUT_ENABLED ? 'Toggle microphone' : 'Voice input disabled'}
          onClick={() => {
            if (!VOICE_INPUT_ENABLED) return
            if (isListening) {
              void stopListening()
            } else {
              void startListening()
            }
          }}
          className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-500/20 text-cyan-200 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          type="button"
          disabled={!VOICE_INPUT_ENABLED}
          title={VOICE_INPUT_ENABLED ? 'Stop speaking' : 'Speech output disabled'}
          onClick={() => {
            if (VOICE_INPUT_ENABLED) stopSpeakingNow()
          }}
          className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-500/20 text-cyan-200 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => void captureScreen('full_screen')}
          className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-500/20 text-cyan-200 transition hover:bg-cyan-500/30"
        >
          {isCapturing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => void analyzeScreen()}
          className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-500/20 text-cyan-200 transition hover:bg-cyan-500/30"
        >
          {isAnalyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
        </button>
      </form>
      <p className="text-xs text-cyan-300/80">
        {!VOICE_INPUT_ENABLED ?
          'Voice off — text chat only. Mic / TTS buttons are disabled.'
        : isListening ?
          'Listening...'
        : isTranscribing ?
          'Transcribing voice...'
        : isSpeaking ?
          'Speaking response...'
        : isAnalyzing ?
          'Analyzing screen...'
        : 'Voice standby'}
      </p>
    </GlassPanel>
  )
}
