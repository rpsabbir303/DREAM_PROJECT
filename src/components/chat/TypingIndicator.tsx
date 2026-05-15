import { motion } from 'framer-motion'
import { ChatJarvisMark } from '@/components/chat/ChatJarvisMark'

interface TypingIndicatorProps {
  label?: string
}

export function TypingIndicator({ label }: TypingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex justify-start"
    >
      <div className="jarvis-msg-assistant max-w-[min(82%,30rem)] w-full text-white/[0.9]">
        <header className="jarvis-msg-assistant-header">
          <ChatJarvisMark />
          <span className="jarvis-msg-assistant-name">JARVIS</span>
        </header>
        <motion.div
          className="jarvis-msg-typing-panel flex items-center gap-2.5"
          initial={{ opacity: 0.88 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <span className="jarvis-msg-typing-dots" aria-hidden>
            <span className="jarvis-typing-dot h-1.5 w-1.5 rounded-full bg-white/50" />
            <span className="jarvis-typing-dot h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="jarvis-typing-dot h-1.5 w-1.5 rounded-full bg-white/35" />
          </span>
          {label && <span className="text-xs text-white/40">{label}</span>}
        </motion.div>
      </div>
    </motion.div>
  )
}
