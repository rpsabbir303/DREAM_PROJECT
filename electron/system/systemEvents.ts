/**
 * System Events — Phase 9
 *
 * Lightweight EventEmitter bus for desktop state changes.
 * All other modules import this singleton and emit/subscribe here.
 *
 * Events:
 *   app_opened       — { app: string, pid: number }
 *   app_closed       — { app: string }
 *   focus_changed    — { from: WindowSnapshot | null, to: WindowSnapshot }
 *   window_minimized — { app: string }
 *   window_restored  — { app: string }
 *   command_executed — { type: string, label: string, ok: boolean }
 *   plan_step        — { step: number, total: number, label: string, ok: boolean }
 */

import { EventEmitter } from 'node:events'
import type { WindowSnapshot } from './runtimeState.js'

// ─── Event map ────────────────────────────────────────────────────────────────

export interface SystemEventMap {
  app_opened:       [{ app: string; pid?: number }]
  app_closed:       [{ app: string }]
  focus_changed:    [{ from: WindowSnapshot | null; to: WindowSnapshot }]
  window_minimized: [{ app: string }]
  window_restored:  [{ app: string }]
  command_executed: [{ type: string; label: string; ok: boolean }]
  plan_step:        [{ step: number; total: number; label: string; ok: boolean }]
}

class JarvisEventBus extends EventEmitter {
  emit<K extends keyof SystemEventMap>(event: K, ...args: SystemEventMap[K]): boolean {
    return super.emit(event, ...args)
  }

  on<K extends keyof SystemEventMap>(event: K, listener: (...args: SystemEventMap[K]) => void): this {
    return super.on(event, listener as (...a: unknown[]) => void)
  }

  once<K extends keyof SystemEventMap>(event: K, listener: (...args: SystemEventMap[K]) => void): this {
    return super.once(event, listener as (...a: unknown[]) => void)
  }

  off<K extends keyof SystemEventMap>(event: K, listener: (...args: SystemEventMap[K]) => void): this {
    return super.off(event, listener as (...a: unknown[]) => void)
  }
}

/** Singleton event bus — import and use everywhere. */
export const systemEvents = new JarvisEventBus()
systemEvents.setMaxListeners(50)
