import type { PropsWithChildren } from 'react'
import { cn } from '@/lib/cn'

interface GlassPanelProps extends PropsWithChildren {
  className?: string
}

export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(13,186,255,0.09)]',
        className,
      )}
    >
      {children}
    </section>
  )
}
