import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { AIOrb } from '../assistant/AIOrb'
import { ClockChip } from './ClockChip'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Overview',
  '/chat': 'Chat',
  '/automation': 'Automation',
  '/memory': 'Memory',
  '/activity-logs': 'Logs',
  '/settings': 'Settings',
}

export function TopNavigation() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] ?? 'JARVIS'

  return (
    <header className="mb-5 flex items-center justify-between gap-4">
      <div>
        <p className="jarvis-label mb-1">System</p>
        <motion.h1
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="jarvis-heading text-xl"
        >
          {title}
        </motion.h1>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3"
      >
        <ClockChip />
        <AIOrb size="sm" active />
      </motion.div>
    </header>
  )
}
