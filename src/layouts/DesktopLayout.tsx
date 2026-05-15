import { motion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { FloatingAssistantButton } from '@/components/assistant/FloatingAssistantButton'
import { AmbientBackground } from '@/components/ui/AmbientBackground'
import { Sidebar } from '@/components/navigation/Sidebar'
import { TopNavigation } from '@/components/navigation/TopNavigation'

export function DesktopLayout() {
  const location = useLocation()
  const isChat = location.pathname === '/chat'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'jarvis-bg relative text-white',
        isChat ? 'flex h-screen overflow-hidden' : 'min-h-screen',
      )}
    >
      <AmbientBackground />

      <motion.div
        className="relative z-[1] flex h-full min-h-0 w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.22 }}
      >
        <Sidebar />
        <main
          className={
            isChat
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
              : 'flex-1 p-5 xl:p-6'
          }
        >
          {!isChat && <TopNavigation />}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={isChat ? 'flex min-h-0 flex-1 flex-col' : undefined}
          >
            <Outlet />
          </motion.div>
        </main>
      </motion.div>
      {!isChat && <FloatingAssistantButton />}
    </motion.div>
  )
}
