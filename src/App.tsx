import type { PropsWithChildren } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { OverlayShell } from '@/overlay/OverlayShell'
import { AppRouter } from '@/routes/AppRouter'

function AppProviders({ children }: PropsWithChildren) {
  return <BrowserRouter>{children}</BrowserRouter>
}

export function App() {
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
