import { globalShortcut } from 'electron'
import type { GlobalShortcutBindings } from '../../shared/interfaces/ipc.js'

export class ShortcutManager {
  register(bindings: GlobalShortcutBindings, callbacks: {
    toggleOverlay: () => void
    toggleVoice: () => void
    quickAutomation: () => void
  }) {
    globalShortcut.unregisterAll()
    this.registerOne(bindings.toggleOverlay, callbacks.toggleOverlay)
    this.registerOne(bindings.toggleVoice, callbacks.toggleVoice)
    this.registerOne(bindings.quickAutomation, callbacks.quickAutomation)
  }

  unregisterAll() {
    globalShortcut.unregisterAll()
  }

  private registerOne(accelerator: string, action: () => void) {
    if (!accelerator) return
    try {
      globalShortcut.register(accelerator, action)
    } catch {
      // Ignore conflicts; callers can inspect behavior from app-side state.
    }
  }
}
