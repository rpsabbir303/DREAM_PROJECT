import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import { App } from './App'

const rootEl = document.getElementById('root')
if (!rootEl) {
  console.error('[JARVIS_RENDERER] #root missing — React cannot mount')
  throw new Error('JARVIS_RENDERER: #root element not found in index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
console.info('[JARVIS_RENDERER] React mounted on #root')
