import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export function ClockChip() {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hours = time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const date = time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="jarvis-glass hidden items-center gap-2 rounded-xl px-3.5 py-2 font-mono text-[11px] tracking-wide sm:flex"
    >
      <span className="text-amber-300/90">{hours}</span>
      <span className="text-amber-400/40">·</span>
      <span className="text-white/45">{date}</span>
    </motion.span>
  )
}
