import { motion } from 'framer-motion'
import { Mic } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function FloatingAssistantButton() {
  const navigate = useNavigate()

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.18 }}
      onClick={() => navigate('/chat')}
      className="fixed bottom-6 right-6 z-50 grid h-11 w-11 place-items-center rounded-full border border-[#b8a078]/30 bg-white/[0.06] text-white/85 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-[18px] hover:border-[#b8a078]/45 hover:bg-white/[0.09]"
      aria-label="Open chat"
    >
      <Mic className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </motion.button>
  )
}
