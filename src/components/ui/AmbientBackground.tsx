import { motion } from 'framer-motion'

/** Purely decorative layered lighting — warm gold / luxury black only. */
export function AmbientBackground() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {/* Warm crown — top center */}
      <motion.div
        className="jarvis-ambient-layer absolute left-1/2 top-[-10%] h-[min(540px,58vh)] w-[min(980px,96vw)] -translate-x-1/2 rounded-full blur-[115px]"
        style={{
          background:
            'radial-gradient(circle, rgba(240,201,135,0.16) 0%, rgba(200,155,94,0.06) 45%, transparent 72%)',
        }}
      />
      {/* Champagne — top right */}
      <motion.div
        className="jarvis-ambient-layer absolute -right-[6%] top-[4%] h-[400px] w-[440px] rounded-full blur-[105px]"
        style={{
          background:
            'radial-gradient(circle, rgba(214,168,106,0.14) 0%, transparent 68%)',
        }}
        animate={{ opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      {/* Bronze — bottom left */}
      <motion.div
        className="jarvis-ambient-layer absolute bottom-[1%] left-[-5%] h-[360px] w-[420px] rounded-full blur-[100px]"
        style={{
          background:
            'radial-gradient(circle, rgba(139,106,61,0.12) 0%, transparent 65%)',
        }}
        animate={{ opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />
      {/* Gold bloom — bottom center (command dock) */}
      <motion.div
        className="jarvis-ambient-layer absolute bottom-0 left-1/2 h-[300px] w-[min(680px,82vw)] -translate-x-1/2 rounded-full blur-[85px]"
        style={{
          background:
            'radial-gradient(ellipse 85% 65% at 50% 100%, rgba(200,155,94,0.14) 0%, transparent 72%)',
        }}
        animate={{ opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
      {/* Center luxury pool */}
      <motion.div
        className="absolute left-1/2 top-[38%] h-[min(520px,56vh)] w-[min(720px,88vw)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[95px] jarvis-breathe"
        style={{
          background:
            'radial-gradient(ellipse 52% 48% at 50% 50%, rgba(240,201,135,0.1) 0%, rgba(200,155,94,0.05) 50%, transparent 74%)',
        }}
      />
    </motion.div>
  )
}
