import { getDevServerUrl, isDesktopViteDev } from './env.js';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { SchedulerService } from '../automation/schedulerService.js';
import { createMemoryRepository } from '../database/memoryRepository.js';
import { registerIpcHandlers } from '../ipc/registerHandlers.js';
import { AssistantEnvironment } from '../overlay/assistantEnvironment.js';
import { createSecureWindowConfig, logPreloadDiagnostics } from '../security/browserWindowConfig.js';
import { probeOpenAiConnectivity } from '../ai/providers/openAiProvider.js';
let mainWindow = null;
let assistantEnvironment = null;
let isQuitting = false;
function attachRendererLoadDiagnostics(webContents) {
    webContents.on('dom-ready', () => {
        console.info('[JARVIS_ELECTRON] renderer dom-ready URL=', webContents.getURL());
    });
    webContents.on('did-finish-load', () => {
        console.info('[JARVIS_ELECTRON] renderer did-finish-load URL=', webContents.getURL());
    });
    webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        console.error('[JARVIS_ELECTRON] renderer did-fail-load', {
            errorCode,
            errorDescription,
            validatedURL,
            hint: 'If dev: ensure Vite is on port 5173 (strictPort) and VITE_DEV_SERVER_URL matches.',
        });
    });
}
function createWindow() {
    const win = new BrowserWindow(createSecureWindowConfig());
    attachRendererLoadDiagnostics(win.webContents);
    win.once('ready-to-show', () => win.show());
    win.on('close', (event) => {
        if (isQuitting)
            return;
        event.preventDefault();
        win.hide();
    });
    mainWindow = win;
    const devUrl = getDevServerUrl();
    if (devUrl) {
        console.info('[JARVIS_ELECTRON] loadURL (dev)=', devUrl);
        void win.loadURL(devUrl);
    }
    else {
        const filePath = path.join(app.getAppPath(), 'dist/index.html');
        console.info('[JARVIS_ELECTRON] loadFile (prod)=', filePath);
        void win.loadFile(filePath);
    }
}
/** MVP bootstrap: memory, scheduled workflows, overlay, and core IPC only. */
app.whenReady().then(() => {
    logPreloadDiagnostics();
    const devUrl = getDevServerUrl();
    console.info('[JARVIS_ELECTRON] NODE_ENV=', process.env.NODE_ENV ?? '(unset)');
    console.info('[JARVIS_ELECTRON] app.isPackaged=', app.isPackaged);
    console.info('[JARVIS_ELECTRON] process.env.VITE_DEV_SERVER_URL=', process.env.VITE_DEV_SERVER_URL ?? '(unset)');
    console.info('[JARVIS_ELECTRON] desktop Vite dev mode=', isDesktopViteDev());
    console.info('[JARVIS_ELECTRON] resolved dev server URL=', devUrl ?? '(none — will load dist/index.html)');
    console.info('[JARVIS_ELECTRON] userData=', app.getPath('userData'));
    const memoryRepository = createMemoryRepository();
    memoryRepository.createDefaultMemoriesIfNeeded();
    const scheduler = new SchedulerService(memoryRepository);
    assistantEnvironment = new AssistantEnvironment(memoryRepository, () => mainWindow);
    registerIpcHandlers({
        memoryRepository,
        assistantEnvironment,
    });
    void probeOpenAiConnectivity();
    scheduler.start();
    createWindow();
    assistantEnvironment.start();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Tray / overlay can keep process alive.
    }
});
app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed())
        createWindow();
    mainWindow?.show();
});
app.on('before-quit', () => {
    isQuitting = true;
    assistantEnvironment?.stop();
});
