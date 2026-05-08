import { Menu, Tray, nativeImage } from 'electron';
const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2a8xQAAAAASUVORK5CYII=';
export function createTray(onAction) {
    const icon = nativeImage.createFromDataURL(`data:image/png;base64,${tinyPng}`);
    const tray = new Tray(icon);
    tray.setToolTip('JARVIS Assistant');
    const menu = Menu.buildFromTemplate([
        { label: 'Open Assistant', click: onAction.openAssistant },
        { label: 'Toggle Voice Mode', click: onAction.toggleVoice },
        { label: 'Quick Automation', click: onAction.quickAutomation },
        { type: 'separator' },
        { label: 'Quit', click: onAction.quit },
    ]);
    tray.setContextMenu(menu);
    tray.on('double-click', onAction.openAssistant);
    return tray;
}
