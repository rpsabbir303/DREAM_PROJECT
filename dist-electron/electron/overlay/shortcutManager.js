import { globalShortcut } from 'electron';
export class ShortcutManager {
    register(bindings, callbacks) {
        globalShortcut.unregisterAll();
        this.registerOne(bindings.toggleOverlay, callbacks.toggleOverlay);
        this.registerOne(bindings.toggleVoice, callbacks.toggleVoice);
        this.registerOne(bindings.quickAutomation, callbacks.quickAutomation);
    }
    unregisterAll() {
        globalShortcut.unregisterAll();
    }
    registerOne(accelerator, action) {
        if (!accelerator)
            return;
        try {
            globalShortcut.register(accelerator, action);
        }
        catch {
            // Ignore conflicts; callers can inspect behavior from app-side state.
        }
    }
}
