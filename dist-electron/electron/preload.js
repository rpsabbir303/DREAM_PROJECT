import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc/contracts.js';
const api = {
    system: {
        getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.systemSnapshot),
    },
    ai: {
        parseIntent: (input) => ipcRenderer.invoke(IPC_CHANNELS.parseIntent, input),
        executeIntent: (input) => ipcRenderer.invoke(IPC_CHANNELS.executeIntent, input),
    },
    memory: {
        getRecentCommands: () => ipcRenderer.invoke(IPC_CHANNELS.memoryRecentCommands),
    },
};
contextBridge.exposeInMainWorld('jarvis', api);
