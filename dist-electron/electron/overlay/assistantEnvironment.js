import { app } from 'electron';
import { createOverlayWindow } from './overlayWindow.js';
import { ShortcutManager } from './shortcutManager.js';
import { createTray } from './trayManager.js';
import { WorkspaceContextService } from './workspaceContextService.js';
export class AssistantEnvironment {
    memoryRepository;
    mainWindowProvider;
    overlayWindow = null;
    shortcutManager = new ShortcutManager();
    workspaceContextService;
    constructor(memoryRepository, mainWindowProvider) {
        this.memoryRepository = memoryRepository;
        this.mainWindowProvider = mainWindowProvider;
        this.workspaceContextService = new WorkspaceContextService(memoryRepository);
    }
    start() {
        this.overlayWindow = createOverlayWindow();
        this.workspaceContextService.start();
        this.registerShortcuts(this.memoryRepository.getShortcutBindings());
        createTray({
            openAssistant: () => this.setOverlayVisible(true),
            toggleVoice: () => this.setOverlayVoiceMode(!this.memoryRepository.getOverlayState().voiceMode),
            quickAutomation: () => this.setOverlayQuickAutomation(!this.memoryRepository.getOverlayState().quickAutomation),
            quit: () => app.quit(),
        });
    }
    stop() {
        this.shortcutManager.unregisterAll();
        this.workspaceContextService.stop();
    }
    getOverlayState() {
        return this.memoryRepository.getOverlayState();
    }
    setOverlayVisible(visible) {
        if (visible) {
            this.ensureOverlayWindow();
            this.overlayWindow?.show();
            this.overlayWindow?.focus();
        }
        else {
            this.overlayWindow?.hide();
        }
        return this.memoryRepository.saveOverlayState({ visible });
    }
    setOverlayDocked(docked) {
        this.ensureOverlayWindow();
        this.overlayWindow?.setAlwaysOnTop(true, docked ? 'screen-saver' : 'floating');
        return this.memoryRepository.saveOverlayState({ docked });
    }
    setOverlayVoiceMode(voiceMode) {
        return this.memoryRepository.saveOverlayState({ voiceMode });
    }
    setOverlayQuickAutomation(quickAutomation) {
        return this.memoryRepository.saveOverlayState({ quickAutomation });
    }
    getShortcutBindings() {
        return this.memoryRepository.getShortcutBindings();
    }
    setShortcutBindings(bindings) {
        const next = this.memoryRepository.saveShortcutBindings(bindings);
        this.registerShortcuts(next);
        return next;
    }
    getWorkspaceContext() {
        return this.memoryRepository.getLatestWorkspaceContext();
    }
    bringMainWindowToFront() {
        const win = this.mainWindowProvider();
        if (!win)
            return;
        if (win.isMinimized())
            win.restore();
        win.show();
        win.focus();
    }
    registerShortcuts(bindings) {
        this.shortcutManager.register(bindings, {
            toggleOverlay: () => this.setOverlayVisible(!this.memoryRepository.getOverlayState().visible),
            toggleVoice: () => this.setOverlayVoiceMode(!this.memoryRepository.getOverlayState().voiceMode),
            quickAutomation: () => this.setOverlayQuickAutomation(!this.memoryRepository.getOverlayState().quickAutomation),
        });
    }
    ensureOverlayWindow() {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed())
            return;
        this.overlayWindow = createOverlayWindow();
    }
}
