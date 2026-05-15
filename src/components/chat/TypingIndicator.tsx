import { motion } from 'framer-motion'

interface TypingIndicatorProps {
  label?: string
}

export function TypingIndicator({ label }: TypingIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex items-center gap-3 px-1 py-2"
    >
      <motion.div
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-500/25 bg-gradient-to-br from-amber-700/18 to-amber-600/10"
        animate={{
          boxShadow: [
            '0 0 16px rgba(200,155,94,0.18), 0 0 12px rgba(240,201,135,0.1)',
            '0 0 24px rgba(240,201,135,0.28), 0 0 18px rgba(200,155,94,0.16)',
            '0 0 16px rgba(200,155,94,0.18), 0 0 12px rgba(240,201,135,0.1)',
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="flex gap-0.5">
          <span className="jarvis-typing-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="jarvis-typing-dot h-1.5 w-1.5 rounded-full bg-amber-300/90" />
          <span className="jarvis-typing-dot h-1.5 w-1.5 rounded-full bg-amber-500/80" />
        </span>
      </motion.div>
      {label && (
        <span className="text-[13px] tracking-wide text-amber-200/45">{label}</span>
      )}
    </motion.div>
  )
}
