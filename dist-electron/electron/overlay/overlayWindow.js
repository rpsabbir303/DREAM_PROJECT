import path from 'node:path';
import { app, BrowserWindow, screen } from 'electron';
import { createSecureWindowConfig } from '../security/browserWindowConfig.js';
import { devServerUrl } from '../main/env.js';
export function createOverlayWindow() {
    const display = screen.getPrimaryDisplay();
    const width = Math.min(520, Math.floor(display.workArea.width * 0.34));
    const height = 420;
    const x = display.workArea.x + display.workArea.width - width - 24;
    const y = display.workArea.y + 24;
    const win = new BrowserWindow({
        ...createSecureWindowConfig(),
        width,
        height,
        minWidth: 420,
        minHeight: 320,
        x,
        y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        focusable: true,
        show: false,
        hasShadow: true,
        backgroundColor: '#00000000',
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    if (devServerUrl) {
        void win.loadURL(`${devServerUrl}?overlay=1`);
    }
    else {
        void win.loadFile(path.join(app.getAppPath(), 'dist/index.html'), { query: { overlay: '1' } });
    }
    return win;
}
