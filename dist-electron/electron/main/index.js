import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { SchedulerService } from '../automation/schedulerService.js';
import { createMemoryRepository } from '../database/memoryRepository.js';
import { registerIpcHandlers } from '../ipc/registerHandlers.js';
import { MultiAgentCoordinator } from '../agents/multiAgentCoordinator.js';
import { KnowledgeIndexingScheduler } from '../knowledge/indexingScheduler.js';
import { ObservabilityOrchestrator } from '../observability/observabilityOrchestrator.js';
import { AdaptiveLearningOrchestrator } from '../learning/adaptiveLearningOrchestrator.js';
import { AssistantEnvironment } from '../overlay/assistantEnvironment.js';
import { PluginManager } from '../skills/pluginManager.js';
import { createSecureWindowConfig } from '../security/browserWindowConfig.js';
import { devServerUrl } from './env.js';
let mainWindow = null;
let assistantEnvironment = null;
let knowledgeScheduler = null;
let observabilityOrchestrator = null;
let learningOrchestrator = null;
let isQuitting = false;
function createWindow() {
    const win = new BrowserWindow(createSecureWindowConfig());
    win.once('ready-to-show', () => win.show());
    win.on('close', (event) => {
        if (isQuitting)
            return;
        event.preventDefault();
        win.hide();
    });
    mainWindow = win;
    if (devServerUrl) {
        void win.loadURL(devServerUrl);
    }
    else {
        void win.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
    }
}
app.whenReady().then(() => {
    const memoryRepository = createMemoryRepository();
    memoryRepository.createDefaultMemoriesIfNeeded();
    const scheduler = new SchedulerService(memoryRepository);
    const pluginManager = new PluginManager(memoryRepository);
    knowledgeScheduler = new KnowledgeIndexingScheduler(memoryRepository, process.cwd());
    observabilityOrchestrator = new ObservabilityOrchestrator(memoryRepository);
    learningOrchestrator = new AdaptiveLearningOrchestrator(memoryRepository);
    const multiAgentCoordinator = new MultiAgentCoordinator(memoryRepository, process.cwd());
    assistantEnvironment = new AssistantEnvironment(memoryRepository, () => mainWindow);
    registerIpcHandlers({
        memoryRepository,
        assistantEnvironment,
        pluginManager,
        knowledgeScheduler,
        multiAgentCoordinator,
        learningOrchestrator,
    });
    scheduler.start();
    knowledgeScheduler.start();
    observabilityOrchestrator.start();
    learningOrchestrator.start();
    createWindow();
    assistantEnvironment.start();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Keep app alive for tray/global assistant behavior.
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
    knowledgeScheduler?.stop();
    observabilityOrchestrator?.stop();
    learningOrchestrator?.stop();
});
