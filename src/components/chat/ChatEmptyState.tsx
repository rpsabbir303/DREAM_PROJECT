import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const PARTICLES = [
  { top: '12%', left: '18%', delay: 0, gold: false },
  { top: '22%', right: '14%', delay: 0.8, gold: true },
  { bottom: '28%', left: '12%', delay: 1.2, gold: true },
  { bottom: '18%', right: '20%', delay: 0.4, gold: false },
  { top: '45%', left: '8%', delay: 1.6, gold: false },
  { top: '38%', right: '10%', delay: 2, gold: true },
] as const

export function ChatEmptyState() {
  return (
    <div className="relative flex min-h-[min(520px,60vh)] flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="jarvis-center-spotlight" aria-hidden />

      {/* Ambient particles */}
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className={`jarvis-particle absolute h-1 w-1 ${p.gold ? 'jarvis-particle--gold' : ''}`}
          style={{
            top: 'top' in p ? p.top : undefined,
            bottom: 'bottom' in p ? p.bottom : undefined,
            left: 'left' in p ? p.left : undefined,
            right: 'right' in p ? p.right : undefined,
          }}
          animate={{ opacity: [0.2, 0.7, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 3 + i * 0.4, repeat: Infinity, delay: p.delay }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="jarvis-hero-panel relative mx-auto max-w-md px-10 py-12 text-center sm:px-14 sm:py-14"
      >
        {/* AI core */}
        <motion.div
          className="relative mx-auto mb-8 h-[88px] w-[88px] jarvis-float"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            className="jarvis-core-ring jarvis-core-ring-outer"
            aria-hidden
          />
          <motion.div className="jarvis-core-ring" aria-hidden />
          <motion.div
            className="absolute inset-0 rounded-full blur-2xl jarvis-breathe"
            style={{
              background:
                'radial-gradient(circle, rgba(240,201,135,0.32) 0%, rgba(200,155,94,0.18) 50%, transparent 72%)',
            }}
          />
          <motion.div
            className="relative grid h-full w-full place-items-center rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-600/25 via-zinc-800/45 to-amber-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_48px_-8px_rgba(200,155,94,0.45),0_0_36px_-12px_rgba(240,201,135,0.28)]"
            animate={{
              boxShadow: [
                'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 48px -8px rgba(200,155,94,0.38), 0 0 36px -12px rgba(240,201,135,0.25)',
                'inset 0 1px 0 rgba(255,255,255,0.16), 0 0 56px -4px rgba(240,201,135,0.5), 0 0 44px -8px rgba(200,155,94,0.35)',
                'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 48px -8px rgba(200,155,94,0.38), 0 0 36px -12px rgba(240,201,135,0.25)',
              ],
            }}
            transition={{ duration: 3.5, repeat: Infinity }}
          >
            <Sparkles className="h-9 w-9 text-amber-100/95" strokeWidth={1.5} />
          </motion.div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="jarvis-heading text-[1.35rem] sm:text-2xl"
        >
          Ready when you are
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="jarvis-subtext mx-auto mt-3 max-w-[280px]"
        >
          Open apps, ask questions, or run commands — your command dock awaits below.
        </motion.p>
      </motion.div>
    </div>
  )
}
