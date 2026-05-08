import { useEffect } from 'react'
import { Bot, Camera, LoaderCircle, Mic, ScanSearch, Send, Square, User, Volume2, VolumeX } from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { useChatStore } from '@/store/chatStore'
import { useScreenStore } from '@/store/screenStore'
import { useVoiceStore } from '@/store/voiceStore'

export function ChatPage() {
  const messages = useChatStore((state) => state.messages)
  const tasks = useChatStore((state) => state.tasks)
  const inputValue = useChatStore((state) => state.inputValue)
  const isThinking = useChatStore((state) => state.isThinking)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const latestUnderstanding = useChatStore((state) => state.latestUnderstanding)
  const providerDecision = useChatStore((state) => state.providerDecision)
  const error = useChatStore((state) => state.error)
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

  useEffect(() => {
    initializeStreamListener()
    initializeVoiceListener()
    void refreshActiveWindow()
  }, [initializeStreamListener, initializeVoiceListener, refreshActiveWindow])

  return (
    <GlassPanel className="grid min-h-[70vh] grid-rows-[1fr_auto] gap-4">
      <div className="space-y-3 overflow-y-auto pr-1">
        <h3 className="text-lg font-semibold text-white">AI Chat Interface</h3>
        <p className="text-sm text-white/60">Streaming assistant responses and command execution pipeline.</p>

        {latestUnderstanding && (
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
            Intent: <span className="font-semibold">{latestUnderstanding.intent}</span>
            {latestUnderstanding.target ? ` | Target: ${latestUnderstanding.target}` : ''}
          </div>
        )}
        {providerDecision && (
          <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-cyan-100">
            Provider: <span className="font-semibold uppercase">{providerDecision.provider}</span> (
            {providerDecision.model}) {providerDecision.isOffline ? '| Offline mode' : ''}
          </div>
        )}

        <div className="space-y-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/25 p-3"
            >
              {message.role === 'user' ? (
                <User className="mt-0.5 h-4 w-4 text-white/70" />
              ) : (
                <Bot className="mt-0.5 h-4 w-4 text-cyan-300" />
              )}
              <div className="text-sm text-white/85">{message.content || '...'}</div>
            </div>
          ))}
        </div>

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
          <div className="flex items-center gap-2 text-xs text-cyan-300">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {isThinking ? 'JARVIS is reasoning...' : 'Streaming response...'}
          </div>
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
          void sendMessage(inputValue)
        }}
      >
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Ask JARVIS or issue a desktop command..."
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
          onClick={() => {
            if (isListening) {
              void stopListening()
            } else {
              void startListening()
            }
          }}
          className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-500/20 text-cyan-200 transition hover:bg-cyan-500/30"
        >
          {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => stopSpeakingNow()}
          className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-500/20 text-cyan-200 transition hover:bg-cyan-500/30"
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
        {isListening
          ? 'Listening...'
          : isTranscribing
            ? 'Transcribing voice...'
            : isSpeaking
              ? 'Speaking response...'
              : isAnalyzing
                ? 'Analyzing screen...'
                : 'Voice standby'}
      </p>
    </GlassPanel>
  )
}
