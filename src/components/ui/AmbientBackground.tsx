/** Subtle ambient depth — matte black, no dock-area bloom. */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute left-1/2 top-0 h-[min(280px,36vh)] w-[min(640px,85vw)] -translate-x-1/2 rounded-full blur-[72px]"
        style={{
          background:
            'radial-gradient(circle, rgba(255,255,255,0.018) 0%, transparent 70%)',
        }}
      />
    </div>
  )
}
