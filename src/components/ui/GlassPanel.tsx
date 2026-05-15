import type { PropsWithChildren } from 'react'
import { cn } from '@/lib/cn'

interface GlassPanelProps extends PropsWithChildren {
  className?: string
  glow?: boolean
}

export function GlassPanel({ children, className, glow = false }: GlassPanelProps) {
  return (
    <section
      className={cn(
        'jarvis-glass rounded-[var(--radius-jarvis-xl)] p-5',
        glow && 'jarvis-glow-border',
        className,
      )}
    >
      {children}
    </section>
  )
}
