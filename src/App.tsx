import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { OverlayShell } from '@/overlay/OverlayShell'
import { AppRouter } from '@/routes/AppRouter'
import { isDesktopBridgeAvailable } from '@/services/desktop/desktopClient'

function AppProviders({ children }: PropsWithChildren) {
  return <BrowserRouter>{children}</BrowserRouter>
}

export function App() {
  useEffect(() => {
    const ok = isDesktopBridgeAvailable()
    console.info('[JARVIS_BRIDGE] renderer sees window.jarvis=', typeof window.jarvis, 'window.electron=', typeof window.electron)
    if (ok) {
      console.info('[JARVIS_UI] desktop bridge present (preload → contextBridge)')
    } else {
      console.warn(
        '[JARVIS_UI] desktop bridge missing — use Electron (`npm run dev`), not a plain browser tab. Check main process logs for [JARVIS_PRELOAD] and preload path.',
      )
    }
  }, [])

  const isOverlay = new URLSearchParams(window.location.search).get('overlay') === '1'
  if (isOverlay) {
    return <OverlayShell />
  }
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}
