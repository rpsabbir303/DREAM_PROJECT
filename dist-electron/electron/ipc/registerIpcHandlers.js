import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc/contracts.js';
import { CommandEngine } from '../services/ai/commandEngine.js';
import { createMemoryRepository } from '../services/memory/memoryRepository.js';
import { getSystemSnapshot } from '../services/system/systemMonitorService.js';
const memoryRepository = createMemoryRepository();
const commandEngine = new CommandEngine(memoryRepository);
export function registerIpcHandlers() {
    ipcMain.handle(IPC_CHANNELS.systemSnapshot, async () => {
        return getSystemSnapshot();
    });
    ipcMain.handle(IPC_CHANNELS.parseIntent, async (_event, userInput) => {
        return commandEngine.parse(userInput);
    });
    ipcMain.handle(IPC_CHANNELS.executeIntent, async (_event, userInput) => {
        return commandEngine.handle(userInput);
    });
    ipcMain.handle(IPC_CHANNELS.memoryRecentCommands, async () => {
        return memoryRepository.getRecentCommands();
    });
}
