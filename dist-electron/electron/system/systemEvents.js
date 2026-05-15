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
import { EventEmitter } from 'node:events';
class JarvisEventBus extends EventEmitter {
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    once(event, listener) {
        return super.once(event, listener);
    }
    off(event, listener) {
        return super.off(event, listener);
    }
}
/** Singleton event bus — import and use everywhere. */
export const systemEvents = new JarvisEventBus();
systemEvents.setMaxListeners(50);
