import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

export function ChatEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex min-h-[calc(100dvh-11rem)] flex-col items-center justify-center py-8"
    >
      <motion.div
        className="jarvis-hero-panel relative mx-auto max-w-sm px-8 py-9 text-center sm:px-10"
      >
        <motion.div
          className="relative mx-auto mb-5 grid h-14 w-14 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] jarvis-float"
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Sparkles className="h-7 w-7 text-white/70" strokeWidth={1.5} />
        </motion.div>

        <h2 className="jarvis-heading text-lg sm:text-xl">Ready when you are</h2>
        <p className="jarvis-subtext mx-auto mt-2 max-w-[260px] text-sm">
          Open apps, ask questions, or run commands — your command dock is below.
        </p>
      </motion.div>
    </motion.div>
  )
}
