import { app, BrowserWindow } from 'electron'
import type {
  AssistantOverlayState,
  GlobalShortcutBindings,
  WorkspaceContext,
} from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'
import { createOverlayWindow } from './overlayWindow.js'
import { ShortcutManager } from './shortcutManager.js'
import { createTray } from './trayManager.js'
import { WorkspaceContextService } from './workspaceContextService.js'

export class AssistantEnvironment {
  private overlayWindow: BrowserWindow | null = null
  private readonly shortcutManager = new ShortcutManager()
  private readonly workspaceContextService: WorkspaceContextService

  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly mainWindowProvider: () => BrowserWindow | null,
  ) {
    this.workspaceContextService = new WorkspaceContextService(memoryRepository)
  }

  start() {
    this.overlayWindow = createOverlayWindow()
    this.workspaceContextService.start()
    this.registerShortcuts(this.memoryRepository.getShortcutBindings())
    createTray({
      openAssistant: () => this.setOverlayVisible(true),
      toggleVoice: () => this.setOverlayVoiceMode(!this.memoryRepository.getOverlayState().voiceMode),
      quickAutomation: () =>
        this.setOverlayQuickAutomation(!this.memoryRepository.getOverlayState().quickAutomation),
      quit: () => app.quit(),
    })
  }

  stop() {
    this.shortcutManager.unregisterAll()
    this.workspaceContextService.stop()
  }

  getOverlayState() {
    return this.memoryRepository.getOverlayState()
  }

  setOverlayVisible(visible: boolean): AssistantOverlayState {
    if (visible) {
      this.ensureOverlayWindow()
      this.overlayWindow?.show()
      this.overlayWindow?.focus()
    } else {
      this.overlayWindow?.hide()
    }
    return this.memoryRepository.saveOverlayState({ visible })
  }

  setOverlayDocked(docked: boolean): AssistantOverlayState {
    this.ensureOverlayWindow()
    this.overlayWindow?.setAlwaysOnTop(true, docked ? 'screen-saver' : 'floating')
    return this.memoryRepository.saveOverlayState({ docked })
  }

  setOverlayVoiceMode(voiceMode: boolean): AssistantOverlayState {
    return this.memoryRepository.saveOverlayState({ voiceMode })
  }

  setOverlayQuickAutomation(quickAutomation: boolean): AssistantOverlayState {
    return this.memoryRepository.saveOverlayState({ quickAutomation })
  }

  getShortcutBindings(): GlobalShortcutBindings {
    return this.memoryRepository.getShortcutBindings()
  }

  setShortcutBindings(bindings: Partial<GlobalShortcutBindings>): GlobalShortcutBindings {
    const next = this.memoryRepository.saveShortcutBindings(bindings)
    this.registerShortcuts(next)
    return next
  }

  getWorkspaceContext(): WorkspaceContext | null {
    return this.memoryRepository.getLatestWorkspaceContext()
  }

  bringMainWindowToFront() {
    const win = this.mainWindowProvider()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }

  private registerShortcuts(bindings: GlobalShortcutBindings) {
    this.shortcutManager.register(bindings, {
      toggleOverlay: () => this.setOverlayVisible(!this.memoryRepository.getOverlayState().visible),
      toggleVoice: () => this.setOverlayVoiceMode(!this.memoryRepository.getOverlayState().voiceMode),
      quickAutomation: () =>
        this.setOverlayQuickAutomation(!this.memoryRepository.getOverlayState().quickAutomation),
    })
  }

  private ensureOverlayWindow() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) return
    this.overlayWindow = createOverlayWindow()
  }
}
