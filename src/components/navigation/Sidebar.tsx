import {
  ActivitySquare,
  Bot,
  Gauge,
  HardDrive,
  Settings,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: Gauge },
  { label: 'AI Chat', to: '/chat', icon: Bot },
  { label: 'Automation', to: '/automation', icon: Workflow },
  { label: 'Memory', to: '/memory', icon: HardDrive },
  { label: 'Activity Logs', to: '/activity-logs', icon: ActivitySquare },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="flex w-72 flex-col border-r border-white/10 bg-black/25 px-4 py-6 backdrop-blur-2xl">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/20">
          <Sparkles className="h-5 w-5 text-cyan-300" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">JARVIS Core</p>
          <h1 className="text-base font-semibold text-white">Desktop Assistant</h1>
        </div>
      </div>

      <nav className="space-y-1">
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/65 transition',
                isActive
                  ? 'bg-cyan-400/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.25)]'
                  : 'hover:bg-white/5 hover:text-white',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
