import { Bell, Search } from 'lucide-react'
import { AIOrb } from '../assistant/AIOrb'

export function TopNavigation() {
  return (
    <header className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 backdrop-blur-xl">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/75">Jarvis Protocol</p>
        <h2 className="text-xl font-semibold text-white">Mission Control</h2>
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-xl border border-white/10 bg-black/20 p-2 text-white/80 transition hover:text-white">
          <Search className="h-4 w-4" />
        </button>
        <button className="rounded-xl border border-white/10 bg-black/20 p-2 text-white/80 transition hover:text-white">
          <Bell className="h-4 w-4" />
        </button>
        <AIOrb size="sm" />
      </div>
    </header>
  )
}
