import path from 'node:path'
import { app, type BrowserWindowConstructorOptions } from 'electron'

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
      preload: path.join(app.getAppPath(), 'dist-electron/electron/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      devTools: true,
    },
  }
}
