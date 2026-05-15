import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChatAssistantMarkdown } from '@/components/chat/ChatAssistantMarkdown'
import { ChatCommandBar } from '@/components/chat/ChatCommandBar'
import { ChatEmptyState } from '@/components/chat/ChatEmptyState'
import { ChatJarvisMark } from '@/components/chat/ChatJarvisMark'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { DebugPanel } from '@/components/debug/DebugPanel'
import { cn } from '@/lib/cn'
import { formatMessageTime } from '@/lib/formatMessageTime'
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
    <div className="jarvis-chat-shell">
      {/* Scrollable transcript — fills space above the dock */}
      <div
        ref={scrollRef}
        className={cn(
          'jarvis-chat-scroll jarvis-chat-canvas',
          showEmpty && !isBusy && 'jarvis-chat-canvas--hero',
        )}
      >
        <div className="jarvis-chat-scroll-inner mx-auto w-full max-w-2xl px-4 pt-3 sm:px-6 sm:pt-4">
          {showEmpty && !isBusy ? (
            <ChatEmptyState />
          ) : (
            <div className="flex flex-col gap-2.5">
              <AnimatePresence initial={false} mode="popLayout">
                {messages.map((message, index) => {
                  const isUser = message.role === 'user'
                  const isLatest = index === messages.length - 1
                  const isAssistantStreaming = isLatest && !isUser && isStreaming
                  const timeLabel = formatMessageTime(message.createdAt)

                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{
                        duration: 0.22,
                        ease: [0.22, 1, 0.36, 1],
                        delay: Math.min(index * 0.04, 0.2),
                      }}
                      className={cn(
                        isUser ? 'flex justify-end' : 'flex justify-start',
                      )}
                    >
                      {isUser ? (
                        <motion.div
                          className="jarvis-msg-user max-w-[min(78%,28rem)] text-white/90"
                          whileHover={{ y: -1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <p className="relative z-[1] whitespace-pre-wrap">
                            {message.content || '…'}
                          </p>
                        </motion.div>
                      ) : (
                        <div className="max-w-[min(82%,30rem)] w-full">
                          <motion.div
                            className="jarvis-msg-assistant text-white/[0.9]"
                            initial={isAssistantStreaming ? { opacity: 0.96 } : false}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            <header className="jarvis-msg-assistant-header">
                              <ChatJarvisMark />
                              <span className="jarvis-msg-assistant-name">JARVIS</span>
                              {timeLabel && (
                                <time
                                  className="jarvis-msg-assistant-time"
                                  dateTime={message.createdAt}
                                >
                                  {timeLabel}
                                </time>
                              )}
                            </header>
                            <div className="jarvis-msg-assistant-body">
                              <motion.div
                                key={
                                  isLatest
                                    ? `${message.id}-${message.content.length}`
                                    : message.id
                                }
                                initial={isLatest ? { opacity: 0.94 } : false}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.18 }}
                              >
                                <ChatAssistantMarkdown content={message.content} />
                              </motion.div>
                            </div>
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
            </div>
          )}
        </div>
      </div>

      {/* Fixed input dock */}
      <div className="jarvis-chat-dock relative px-4 py-3 sm:px-6 xl:px-10">
        {displayError && (
          <p
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 max-w-md -translate-x-1/2 rounded-lg border border-white/[0.08] bg-[#121214]/95 px-3 py-1.5 text-center text-[11px] text-white/55 shadow-[0_2px_12px_rgba(0,0,0,0.2)] backdrop-blur-md"
            role="status"
          >
            {displayError}
          </p>
        )}
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
      <DebugPanel />
    </div>
  )
}
