import { motion } from 'framer-motion'
import { Outlet } from 'react-router-dom'
import { FloatingAssistantButton } from '@/components/assistant/FloatingAssistantButton'
import { Sidebar } from '@/components/navigation/Sidebar'
import { TopNavigation } from '@/components/navigation/TopNavigation'

export function DesktopLayout() {
  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,#1e3a8a40,transparent_35%),radial-gradient(circle_at_80%_20%,#06b6d420,transparent_25%)]" />
      <div className="relative flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">
          <TopNavigation />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
      <FloatingAssistantButton />
    </div>
  )
}
