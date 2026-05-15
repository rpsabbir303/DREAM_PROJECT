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
    <aside className="jarvis-sidebar relative z-10 flex w-[68px] flex-col py-6 xl:w-[200px]">
      <span className="jarvis-sidebar-edge" aria-hidden />

      <motion.div
        className="mb-9 flex items-center justify-center gap-0 px-3 xl:justify-start xl:gap-3"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
      >
        <motion.div
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-700/22 via-zinc-900/55 to-amber-600/18 shadow-[0_0_32px_-6px_rgba(240,201,135,0.35),0_0_28px_-8px_rgba(200,155,94,0.28),inset_0_1px_0_rgba(255,255,255,0.1)]"
          whileHover={{ scale: 1.06, y: -1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        >
          <motion.div
            className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-500/18 to-amber-400/12 blur-md jarvis-shimmer"
          />
          <Sparkles className="relative h-4 w-4 text-amber-100/95" strokeWidth={1.75} />
        </motion.div>
        <span className="hidden bg-gradient-to-r from-white via-white/90 to-amber-100/70 bg-clip-text text-sm font-semibold tracking-tight text-transparent xl:inline">
          JARVIS
        </span>
      </motion.div>

      <nav className="flex flex-1 flex-col gap-1.5 px-2.5">
        {navItems.map(({ label, to, icon: Icon }, index) => {
          const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`)
          return (
            <NavLink key={to} to={to} title={label} className="relative block">
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl border border-amber-500/22 bg-gradient-to-r from-amber-600/18 via-amber-700/12 to-amber-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_-6px_rgba(240,201,135,0.35),0_0_24px_-8px_rgba(200,155,94,0.22)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * index }}
                whileHover={!isActive ? { x: 2 } : undefined}
                className={cn(
                  'relative flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 xl:justify-start',
                  isActive
                    ? 'text-amber-50'
                    : 'text-white/38 hover:bg-white/[0.05] hover:text-white/78 hover:shadow-[inset_0_0_20px_rgba(200,155,94,0.08),0_0_24px_-12px_rgba(240,201,135,0.1)]',
                )}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-all duration-300',
                    isActive ? 'text-amber-200/95 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]' : '',
                  )}
                  strokeWidth={isActive ? 2 : 1.75}
                />
                <span className="hidden text-[13px] font-medium tracking-wide xl:inline">{label}</span>
              </motion.span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
