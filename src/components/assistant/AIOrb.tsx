import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface AIOrbProps {
  active?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'h-9 w-9',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
}

export function AIOrb({ active = true, size = 'md' }: AIOrbProps) {
  return (
    <motion.div
      className={cn('relative grid place-items-center rounded-full', sizeMap[size])}
      animate={active ? { scale: [1, 1.04, 1] } : {}}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.div
        className="absolute inset-[-20%] rounded-full blur-xl jarvis-breathe"
        style={{
          background:
            'radial-gradient(circle, rgba(240,201,135,0.32) 0%, rgba(200,155,94,0.16) 45%, transparent 70%)',
        }}
      />
      <motion.div
        className="absolute inset-[6%] rounded-full border border-amber-500/20"
        style={{ boxShadow: 'inset 0 0 16px rgba(200,155,94,0.14)' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 16, ease: 'linear', repeat: Infinity }}
      />
      <motion.div
        className="absolute inset-[14%] rounded-full border border-amber-400/15"
        animate={{ rotate: -360 }}
        transition={{ duration: 22, ease: 'linear', repeat: Infinity }}
      />
      <motion.div
        className="relative h-[48%] w-[48%] rounded-full bg-gradient-to-br from-amber-200/95 via-amber-600/80 to-amber-400/70 shadow-[inset_0_2px_0_rgba(255,255,255,0.32),0_0_20px_rgba(240,201,135,0.38)]"
        animate={active ? { opacity: [0.88, 1, 0.88] } : { opacity: 0.55 }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />
    </motion.div>
  )
}
