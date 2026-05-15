import {
  ActivitySquare,
  Bot,
  Gauge,
  HardDrive,
  Settings,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

const navItems = [
  { label: 'Home', to: '/dashboard', icon: Gauge },
  { label: 'Chat', to: '/chat', icon: Bot },
  { label: 'Automation', to: '/automation', icon: Workflow },
  { label: 'Memory', to: '/memory', icon: HardDrive },
  { label: 'Logs', to: '/activity-logs', icon: ActivitySquare },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="jarvis-sidebar relative z-10 flex w-[60px] flex-col py-5 xl:w-[188px]">
      <span className="jarvis-sidebar-edge" aria-hidden />

      <motion.div
        className="mb-8 flex items-center justify-center gap-0 px-2.5 xl:justify-start xl:gap-2.5"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.2 }}
      >
        <motion.div
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04]"
          whileHover={{ scale: 1.04 }}
          transition={{ duration: 0.18 }}
        >
          <Sparkles className="relative h-4 w-4 text-white/75" strokeWidth={1.75} />
        </motion.div>
        <span className="hidden text-sm font-semibold tracking-tight text-white/90 xl:inline">
          JARVIS
        </span>
      </motion.div>

      <nav className="flex flex-1 flex-col gap-1 px-2">
        {navItems.map(({ label, to, icon: Icon }, index) => {
          const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`)
          return (
            <NavLink key={to} to={to} title={label} className="relative block">
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg border border-white/[0.08] bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * index }}
                whileHover={!isActive ? { x: 2 } : undefined}
                className={cn(
                  'relative flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-[180ms] xl:justify-start',
                  isActive
                    ? 'text-white/92'
                    : 'text-white/40 hover:bg-white/[0.04] hover:text-white/72',
                )}
              >
                <Icon
                  className={cn(
                    'h-[17px] w-[17px] shrink-0 transition-colors duration-[180ms]',
                    isActive ? 'text-[#e8e4dc]' : '',
                  )}
                  strokeWidth={isActive ? 2 : 1.75}
                />
                <span className="hidden text-[13px] font-medium xl:inline">{label}</span>
              </motion.span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
