import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { registerIpcHandlers } from './ipc/registerIpcHandlers.js';
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
function createWindow() {
    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1280,
        minHeight: 760,
        backgroundColor: '#070b14',
        show: false,
        webPreferences: {
            preload: path.join(app.getAppPath(), 'dist-electron/electron/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            devTools: true,
        },
    });
    win.once('ready-to-show', () => win.show());
    if (VITE_DEV_SERVER_URL) {
        void win.loadURL(VITE_DEV_SERVER_URL);
    }
    else {
        void win.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
    }
}
app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
        createWindow();
});
