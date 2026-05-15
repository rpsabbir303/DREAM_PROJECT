import { safeLogger } from '../main/safeLogger.js'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { type BrowserWindowConstructorOptions } from 'electron'

/**
 * Absolute path to the compiled preload bundle.
 * Must NOT use app.getAppPath() — in dev, `electron ./dist-electron/.../main/index.js` can make
 * getAppPath() point at the wrong tree so preload never loads and `window.jarvis` / `window.electron` stay undefined.
 */
const SECURITY_DIR = path.dirname(fileURLToPath(import.meta.url))
export const PRELOAD_ABSOLUTE_PATH = path.normalize(path.join(SECURITY_DIR, '..', 'preload', 'index.js'))

export function logPreloadDiagnostics(): void {
  safeLogger.info('[JARVIS_ELECTRON] preload path:', PRELOAD_ABSOLUTE_PATH)
  safeLogger.info('[JARVIS_ELECTRON] preload exists:', existsSync(PRELOAD_ABSOLUTE_PATH))
  if (!existsSync(PRELOAD_ABSOLUTE_PATH)) {
    safeLogger.error('[JARVIS_ELECTRON] preload file missing — run `npm run build:electron`')
  }
}

/**
 * Single source of truth for BrowserWindow security posture.
 */
export function createSecureWindowConfig(): BrowserWindowConstructorOptions {
  return {
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 760,
    backgroundColor: '#070b14',
    show: false,
    webPreferences: {
      preload: PRELOAD_ABSOLUTE_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      // Sandboxed preload + sibling ESM imports (shared/ipcChannels) often fails to bind `contextBridge`
      // so `window.jarvis` stays undefined. Keep nodeIntegration off; disabling sandbox restores a reliable bridge.
      sandbox: false,
      webSecurity: true,
      webviewTag: false,
      devTools: true,
    },
  }
}
