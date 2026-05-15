import { motion } from 'framer-motion'
import { Mic } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function FloatingAssistantButton() {
  const navigate = useNavigate()

  return (
    <motion.button
      type="button"
      whileHover={{
        scale: 1.1,
        boxShadow:
          '0 0 48px rgba(240,201,135,0.38), 0 0 36px rgba(200,155,94,0.25), 0 14px 32px rgba(0,0,0,0.48)',
      }}
      whileTap={{ scale: 0.94 }}
      onClick={() => navigate('/chat')}
      className="fixed bottom-6 right-6 z-50 grid h-12 w-12 place-items-center rounded-full border border-amber-400/35 bg-gradient-to-br from-amber-500/95 via-amber-700/90 to-amber-600/85 text-white shadow-[0_0_32px_rgba(200,155,94,0.35),0_0_24px_rgba(240,201,135,0.22),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-md"
      aria-label="Open chat"
    >
      <motion.span
        className="absolute inset-0 rounded-full border border-amber-300/40"
        animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />
      <Mic className="relative h-5 w-5" strokeWidth={1.75} />
    </motion.button>
  )
}
