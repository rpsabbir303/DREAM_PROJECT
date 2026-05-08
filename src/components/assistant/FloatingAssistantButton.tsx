import { motion } from 'framer-motion'
import { Mic } from 'lucide-react'

export function FloatingAssistantButton() {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      className="fixed bottom-8 right-8 z-50 flex items-center gap-2 rounded-full border border-cyan-300/30 bg-gradient-to-r from-cyan-500/90 to-blue-600/80 px-4 py-2 text-sm font-medium text-white shadow-[0_0_25px_rgba(34,211,238,0.45)]"
    >
      <Mic className="h-4 w-4" />
      Activate Voice
    </motion.button>
  )
}
