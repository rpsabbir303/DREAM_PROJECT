import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface AIOrbProps {
  active?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'h-12 w-12',
  md: 'h-20 w-20',
  lg: 'h-28 w-28',
}

export function AIOrb({ active = true, size = 'md' }: AIOrbProps) {
  return (
    <div className={cn('relative grid place-items-center rounded-full', sizeMap[size])}>
      <motion.div
        className="absolute inset-0 rounded-full bg-cyan-400/35 blur-md"
        animate={{ scale: active ? [1, 1.15, 1] : 1, opacity: active ? [0.5, 0.9, 0.5] : 0.35 }}
        transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY }}
      />
      <motion.div
        className="absolute inset-[8%] rounded-full border border-cyan-300/45"
        animate={{ rotate: 360 }}
        transition={{ duration: 9, ease: 'linear', repeat: Number.POSITIVE_INFINITY }}
      />
      <motion.div
        className="relative h-[56%] w-[56%] rounded-full bg-gradient-to-br from-cyan-300 via-cyan-500 to-indigo-500"
        animate={active ? { scale: [1, 1.07, 1] } : { scale: 1 }}
        transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY }}
      />
    </div>
  )
}
