import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChatAssistantMarkdown } from '@/components/chat/ChatAssistantMarkdown'
import { ChatCommandBar } from '@/components/chat/ChatCommandBar'
import { ChatEmptyState } from '@/components/chat/ChatEmptyState'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { cn } from '@/lib/cn'
import { jarvisThinkingLabel } from '@/lib/jarvisChatUx'
import { useChatStore } from '@/store/chatStore'
import { useScreenStore } from '@/store/screenStore'
import { useVoiceStore, VOICE_INPUT_ENABLED } from '@/store/voiceStore'

export function ChatPage() {
  const messages = useChatStore((state) => state.messages)
  const inputValue = useChatStore((state) => state.inputValue)
  const isThinking = useChatStore((state) => state.isThinking)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const error = useChatStore((state) => state.error)
  const activeStreamId = useChatStore((state) => state.activeStreamId)
  const setInputValue = useChatStore((state) => state.setInputValue)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const initializeStreamListener = useChatStore((state) => state.initializeStreamListener)
  const isListening = useVoiceStore((state) => state.isListening)
  const isSpeaking = useVoiceStore((state) => state.isSpeaking)
  const isTranscribing = useVoiceStore((state) => state.isTranscribing)
  const voiceError = useVoiceStore((state) => state.error)
  const startListening = useVoiceStore((state) => state.startListening)
  const stopListening = useVoiceStore((state) => state.stopListening)
  const stopSpeakingNow = useVoiceStore((state) => state.stopSpeakingNow)
  const initializeVoiceListener = useVoiceStore((state) => state.initializeVoiceListener)
  const isCapturing = useScreenStore((state) => state.isCapturing)
  const isAnalyzing = useScreenStore((state) => state.isAnalyzing)
  const screenError = useScreenStore((state) => state.error)
  const captureScreen = useScreenStore((state) => state.captureScreen)
  const analyzeScreen = useScreenStore((state) => state.analyzeScreen)
  const refreshActiveWindow = useScreenStore((state) => state.refreshActiveWindow)

  const scrollRef = useRef<HTMLDivElement>(null)
  const showEmpty = messages.length === 0
  const isBusy = isThinking || isStreaming

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

  const displayError = error || voiceError || screenError

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* Message canvas */}
      <motion.div
        ref={scrollRef}
        className={cn(
          'jarvis-chat-canvas flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth px-4 pb-4 pt-5 sm:px-6 xl:px-10',
          showEmpty && !isBusy && 'jarvis-chat-canvas--hero',
        )}
      >
        {showEmpty && !isBusy ? (
          <ChatEmptyState />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="jarvis-glass jarvis-glow-border relative z-[1] mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl p-5 sm:p-6"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((message, index) => {
                const isUser = message.role === 'user'
                const isLatest = index === messages.length - 1
                const isAssistantStreaming = isLatest && !isUser && isStreaming

                return (
                  <motion.div
                    key={message.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    className={isUser ? 'flex justify-end' : 'flex justify-start'}
                  >
                    {isUser ? (
                      <div className="jarvis-msg-user max-w-[85%] rounded-2xl rounded-br-lg px-4 py-3.5 text-[15px] leading-relaxed text-white/92">
                        <p className="whitespace-pre-wrap">{message.content || '…'}</p>
                      </div>
                    ) : (
                      <div className="group relative max-w-[92%]">
                        <motion.div
                          className="absolute -inset-px rounded-2xl opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-100"
                          style={{
                            background:
                              'linear-gradient(135deg, rgba(240,201,135,0.18) 0%, transparent 50%, rgba(200,155,94,0.12) 100%)',
                          }}
                          animate={
                            isLatest && isBusy
                              ? { opacity: [0.4, 0.7, 0.4] }
                              : { opacity: 0.5 }
                          }
                          transition={{ duration: 2.5, repeat: isLatest && isBusy ? Infinity : 0 }}
                        />
                        <motion.div
                          className="jarvis-msg-assistant relative rounded-2xl rounded-bl-lg px-5 py-4"
                          initial={isAssistantStreaming ? { opacity: 0.95 } : false}
                          animate={{ opacity: 1 }}
                        >
                          <motion.div
                            key={isLatest ? `${message.id}-${message.content.length}` : message.id}
                            initial={isLatest ? { opacity: 0.9 } : false}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="text-[15px] leading-[1.65] text-white/[0.92]"
                          >
                            <ChatAssistantMarkdown content={message.content} />
                          </motion.div>
                        </motion.div>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>

            <AnimatePresence>
              {isBusy && (
                <TypingIndicator label={jarvisThinkingLabel(activeStreamId, isStreaming)} />
              )}
            </AnimatePresence>

            {displayError && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200/90"
              >
                {displayError}
              </motion.p>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Floating command dock */}
      <div className="relative shrink-0 px-4 py-5 sm:px-6 xl:px-10">
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/15 to-transparent"
          aria-hidden
        />
        <motion.div
          className="pointer-events-none absolute inset-x-8 top-0 h-24 bg-gradient-to-t from-[#050505] via-[#0b0b0d]/85 to-transparent"
          aria-hidden
        />
        <ChatCommandBar
          value={inputValue}
          onChange={setInputValue}
          onSubmit={() => {
            const trimmed = inputValue.trim()
            if (!trimmed) return
            console.info('[JARVIS_UI] send (submit), chars=', trimmed.length)
            void sendMessage(inputValue)
          }}
          isListening={isListening}
          isSpeaking={isSpeaking}
          isTranscribing={isTranscribing}
          isCapturing={isCapturing}
          isAnalyzing={isAnalyzing}
          onToggleMic={() => {
            if (!VOICE_INPUT_ENABLED) return
            if (isListening) void stopListening()
            else void startListening()
          }}
          onStopSpeaking={() => {
            if (VOICE_INPUT_ENABLED) stopSpeakingNow()
          }}
          onCapture={() => void captureScreen('full_screen')}
          onAnalyze={() => void analyzeScreen()}
          disabled={isBusy}
        />
      </div>
    </motion.div>
  )
}
