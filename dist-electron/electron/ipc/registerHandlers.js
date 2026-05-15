import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels.js';
import { WorkflowEngine } from '../automation/workflowEngine.js';
import { ChatEngine } from '../ai/chatEngine.js';
import { CommandEngine } from '../ai/commandEngine.js';
import { getSystemSnapshot } from '../system/systemMonitorService.js';
import { getActiveWindowInfo } from '../vision/activeWindowService.js';
import { analyzeCapture } from '../vision/screenAnalysisService.js';
import { captureScreen } from '../vision/screenCaptureService.js';
import { getProviderModels, getProviderStatus } from '../ai/providerRouter.js';
import { searchCommandPalette } from '../overlay/commandPaletteService.js';
const chatStartInputSchema = z.object({
    streamId: z.string().min(8).max(80),
    input: z.string().min(1).max(4000),
    history: z
        .array(z.object({
        id: z.string(),
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
        createdAt: z.string(),
    }))
        .max(50),
});
const workflowPromptSchema = z.string().min(6).max(500);
const aiSettingsUpdateSchema = z.object({
    preferredProvider: z.enum(['gemini']).optional(),
    offlineMode: z.boolean().optional(),
    localModel: z.string().min(1).max(120).optional(),
    cloudModel: z.string().min(1).max(120).optional(),
    reasoningThreshold: z.number().int().min(40).max(2000).optional(),
});
/**
 * MVP IPC surface: chat, intents, execution, memory, workflows, overlay, voice, screen, system.
 */
export function registerIpcHandlers({ memoryRepository, assistantEnvironment, }) {
    const commandEngine = new CommandEngine(memoryRepository);
    const chatEngine = new ChatEngine(memoryRepository);
    const workflowEngine = new WorkflowEngine(memoryRepository);
    ipcMain.handle(IPC_CHANNELS.systemSnapshot, async () => {
        return getSystemSnapshot();
    });
    ipcMain.handle(IPC_CHANNELS.parseIntent, async (_event, userInput) => {
        return commandEngine.parse(userInput);
    });
    ipcMain.handle(IPC_CHANNELS.aiProviderSettingsGet, async () => {
        return memoryRepository.getAiSettings();
    });
    ipcMain.handle(IPC_CHANNELS.aiProviderSettingsSet, async (_event, payload) => {
        const parsed = aiSettingsUpdateSchema.parse(payload);
        return memoryRepository.saveAiSettings(parsed);
    });
    ipcMain.handle(IPC_CHANNELS.aiProviderModels, async () => {
        const settings = memoryRepository.getAiSettings();
        return getProviderModels(settings);
    });
    ipcMain.handle(IPC_CHANNELS.aiProviderStatus, async () => {
        return getProviderStatus();
    });
    ipcMain.handle(IPC_CHANNELS.aiProviderMetrics, async () => {
        return memoryRepository.getAiProviderMetrics(80);
    });
    ipcMain.handle(IPC_CHANNELS.overlayGetState, async () => {
        return assistantEnvironment.getOverlayState();
    });
    ipcMain.handle(IPC_CHANNELS.overlaySetVisible, async (_event, visible) => {
        return assistantEnvironment.setOverlayVisible(visible);
    });
    ipcMain.handle(IPC_CHANNELS.overlaySetDocked, async (_event, docked) => {
        return assistantEnvironment.setOverlayDocked(docked);
    });
    ipcMain.handle(IPC_CHANNELS.overlaySetVoiceMode, async (_event, voiceMode) => {
        return assistantEnvironment.setOverlayVoiceMode(voiceMode);
    });
    ipcMain.handle(IPC_CHANNELS.overlaySetQuickAutomation, async (_event, enabled) => {
        return assistantEnvironment.setOverlayQuickAutomation(enabled);
    });
    ipcMain.handle(IPC_CHANNELS.overlayGetShortcuts, async () => {
        return assistantEnvironment.getShortcutBindings();
    });
    ipcMain.handle(IPC_CHANNELS.overlaySetShortcuts, async (_event, bindings) => {
        return assistantEnvironment.setShortcutBindings(bindings);
    });
    ipcMain.handle(IPC_CHANNELS.overlayWorkspaceContext, async () => {
        return assistantEnvironment.getWorkspaceContext();
    });
    ipcMain.handle(IPC_CHANNELS.overlayCommandPaletteSearch, async (_event, query) => {
        return searchCommandPalette(memoryRepository, query);
    });
    ipcMain.handle(IPC_CHANNELS.executeIntent, async (_event, userInput) => {
        return commandEngine.handle(userInput);
    });
    ipcMain.handle(IPC_CHANNELS.memoryRecentCommands, async () => {
        return memoryRepository.getRecentCommands();
    });
    ipcMain.handle(IPC_CHANNELS.memoryOverview, async () => {
        return memoryRepository.createMemoryOverview();
    });
    ipcMain.handle(IPC_CHANNELS.memoryCommandStats, async () => {
        return memoryRepository.getCommandMemoryStats(20);
    });
    ipcMain.handle(IPC_CHANNELS.memoryWorkflows, async () => {
        return memoryRepository.getWorkflows();
    });
    ipcMain.handle(IPC_CHANNELS.memoryProjects, async () => {
        return memoryRepository.getProjects();
    });
    ipcMain.handle(IPC_CHANNELS.memorySuggestions, async () => {
        return memoryRepository.getPersonalizationSuggestions(12);
    });
    ipcMain.handle(IPC_CHANNELS.workflowExecute, async (_event, workflowId) => {
        return workflowEngine.executeWorkflow(workflowId);
    });
    ipcMain.handle(IPC_CHANNELS.workflowSchedules, async () => {
        return memoryRepository.getWorkflowSchedules();
    });
    ipcMain.handle(IPC_CHANNELS.workflowRuns, async () => {
        return memoryRepository.getWorkflowRuns(60);
    });
    ipcMain.handle(IPC_CHANNELS.workflowGenerate, async (_event, prompt) => {
        const validatedPrompt = workflowPromptSchema.parse(prompt);
        return memoryRepository.generateWorkflowFromPrompt(validatedPrompt);
    });
    ipcMain.handle(IPC_CHANNELS.executionRecentLogs, async () => {
        return memoryRepository.getRecentActivityLogs(120);
    });
    ipcMain.handle(IPC_CHANNELS.executionRecentTasks, async () => {
        return memoryRepository.getRecentTasks(40);
    });
    ipcMain.handle(IPC_CHANNELS.aiChatStartStream, async (event, payload) => {
        const parsed = chatStartInputSchema.safeParse(payload);
        if (!parsed.success) {
            const sid = payload && typeof payload === 'object' && 'streamId' in payload && typeof payload.streamId === 'string'
                ? payload.streamId
                : undefined;
            const msg = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') ||
                parsed.error.message;
            console.warn('[JARVIS_AI] aiChatStartStream validation failed:', msg, payload);
            if (sid && !event.sender.isDestroyed()) {
                event.sender.send(IPC_CHANNELS.aiChatStreamEvent, {
                    streamId: sid,
                    type: 'error',
                    data: { message: `Invalid chat request: ${msg}` },
                });
            }
            throw parsed.error;
        }
        console.info('[JARVIS_IPC] aiChatStartStream accepted', parsed.data.streamId, 'len=', parsed.data.input.length);
        await chatEngine.startStream(parsed.data, event.sender);
        return { accepted: true };
    });
    ipcMain.handle(IPC_CHANNELS.aiChatCancelStream, async (_event, streamId) => {
        return { cancelled: chatEngine.cancelStream(streamId) };
    });
    ipcMain.handle(IPC_CHANNELS.voiceTranscribe, async () => {
        console.warn('[JARVIS_VOICE] voiceTranscribe IPC disabled — text chat MVP (no Whisper)');
        return { text: '', durationMs: 0 };
    });
    ipcMain.handle(IPC_CHANNELS.screenCapture, async (_event, source) => {
        return captureScreen(source ?? 'full_screen');
    });
    ipcMain.handle(IPC_CHANNELS.screenActiveWindow, async () => {
        return getActiveWindowInfo();
    });
    ipcMain.handle(IPC_CHANNELS.screenAnalyze, async () => {
        const capture = await captureScreen('full_screen');
        return analyzeCapture(capture, memoryRepository);
    });
    ipcMain.handle(IPC_CHANNELS.screenHistory, async () => {
        return memoryRepository.getRecentScreenAnalyses(24);
    });
}
