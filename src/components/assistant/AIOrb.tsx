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
      className={cn(
        'relative grid place-items-center rounded-full border border-white/[0.08] bg-white/[0.04]',
        sizeMap[size],
      )}
      animate={active ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.div
        className="rounded-full bg-white/[0.12]"
        style={{ width: '38%', height: '38%' }}
        animate={active ? { opacity: [0.5, 0.85, 0.5] } : { opacity: 0.35 }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />
    </motion.div>
  )
}
