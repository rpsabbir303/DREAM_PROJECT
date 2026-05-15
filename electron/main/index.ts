// Loaded via bootstrap.ts after safeLogger — use safeLogger only (never console.*)
import { safeLogger } from './safeLogger.js'

// loadDesktopEnvironment logs via safeLogger; call after bootstrap loads safeLogger
import { getDevServerUrl, isDesktopViteDev, loadDesktopEnvironment } from './env.js'
import path from 'node:path'
import { app, BrowserWindow, type WebContents } from 'electron'
import { SchedulerService } from '../automation/schedulerService.js'
import { createMemoryRepository } from '../database/memoryRepository.js'
import { registerIpcHandlers } from '../ipc/registerHandlers.js'
import { AssistantEnvironment } from '../overlay/assistantEnvironment.js'
import { createSecureWindowConfig, logPreloadDiagnostics } from '../security/browserWindowConfig.js'
import { initializeJarvisGeminiOnStartup } from '../ai/providers/geminiProvider.js'
import { startWindowTracking, stopWindowTracking } from '../system/windowState.js'
import { initDiscovery, stopDiscovery } from '../system/appDiscovery.js'
import { startDesktopStateEngine, stopDesktopStateEngine } from '../system/desktopStateEngine.js'
import { startProcessGraph, stopProcessGraph } from '../system/runtimeProcessGraph.js'

let mainWindow: BrowserWindow | null = null
let assistantEnvironment: AssistantEnvironment | null = null
let isQuitting = false

function attachRendererLoadDiagnostics(webContents: WebContents): void {
  webContents.on('dom-ready', () => {
    safeLogger.info('[JARVIS_ELECTRON] renderer dom-ready URL=', webContents.getURL())
  })
  webContents.on('did-finish-load', () => {
    safeLogger.info('[JARVIS_ELECTRON] renderer did-finish-load URL=', webContents.getURL())
  })
  webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    safeLogger.error('[JARVIS_ELECTRON] renderer did-fail-load', errorCode, errorDescription, validatedURL)
  })
}

function createWindow() {
  const win = new BrowserWindow(createSecureWindowConfig())
  attachRendererLoadDiagnostics(win.webContents)
  win.once('ready-to-show', () => win.show())
  win.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    win.hide()
  })
  mainWindow = win

  const devUrl = getDevServerUrl()
  if (devUrl) {
    safeLogger.info('[JARVIS_ELECTRON] loadURL (dev)=', devUrl)
    void win.loadURL(devUrl)
  } else {
    const filePath = path.join(app.getAppPath(), 'dist/index.html')
    safeLogger.info('[JARVIS_ELECTRON] loadFile (prod)=', filePath)
    void win.loadFile(filePath)
  }
}

/** MVP bootstrap: memory, scheduled workflows, overlay, and core IPC only. */
app.whenReady().then(() => {
  loadDesktopEnvironment()   // must run after safeLogger overrides console
  logPreloadDiagnostics()
  const devUrl = getDevServerUrl()
  safeLogger.info('[JARVIS_ELECTRON] NODE_ENV=', process.env.NODE_ENV ?? '(unset)')
  safeLogger.info('[JARVIS_ELECTRON] app.isPackaged=', app.isPackaged)
  safeLogger.info('[JARVIS_ELECTRON] VITE_DEV_SERVER_URL=', process.env.VITE_DEV_SERVER_URL ?? '(unset)')
  safeLogger.info('[JARVIS_ELECTRON] desktop Vite dev mode=', isDesktopViteDev())
  safeLogger.info('[JARVIS_ELECTRON] resolved dev server URL=', devUrl ?? '(none)')
  safeLogger.info('[JARVIS_ELECTRON] userData=', app.getPath('userData'))

  const memoryRepository = createMemoryRepository()
  memoryRepository.createDefaultMemoriesIfNeeded()
  const scheduler = new SchedulerService(memoryRepository)
  assistantEnvironment = new AssistantEnvironment(memoryRepository, () => mainWindow)
  registerIpcHandlers({ memoryRepository, assistantEnvironment })
  void initializeJarvisGeminiOnStartup()
  scheduler.start()
  createWindow()
  assistantEnvironment.start()
  startWindowTracking()
  initDiscovery()
  startDesktopStateEngine()
  startProcessGraph()
}).catch((e: unknown) => {
  safeLogger.error('[JARVIS_ELECTRON] app.whenReady failed:', e instanceof Error ? e.message : String(e))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Tray / overlay keeps process alive — do not quit here.
  }
})

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow()
  mainWindow?.show()
})

app.on('before-quit', () => {
  isQuitting = true
  assistantEnvironment?.stop()
  stopWindowTracking()
  stopDiscovery()
  stopDesktopStateEngine()
  stopProcessGraph()
})

// Catch renderer crashes so they don't propagate silently
app.on('render-process-gone', (_event, _webContents, details) => {
  safeLogger.warn('[JARVIS_ELECTRON] renderer gone reason=', details.reason, 'exitCode=', details.exitCode)
})

app.on('child-process-gone', (_event, details) => {
  safeLogger.warn('[JARVIS_ELECTRON] child process gone type=', details.type, 'reason=', details.reason)
})
