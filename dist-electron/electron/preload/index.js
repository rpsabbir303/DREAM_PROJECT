import { safeLogger } from '../main/safeLogger.js';
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels.js';
safeLogger.info('[JARVIS_PRELOAD] preload initialized');
const api = {
    system: {
        getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.systemSnapshot),
    },
    ai: {
        parseIntent: (input) => ipcRenderer.invoke(IPC_CHANNELS.parseIntent, input),
        executeIntent: (input) => ipcRenderer.invoke(IPC_CHANNELS.executeIntent, input),
        getProviderSettings: () => ipcRenderer.invoke(IPC_CHANNELS.aiProviderSettingsGet),
        updateProviderSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.aiProviderSettingsSet, settings),
        getProviderModels: () => ipcRenderer.invoke(IPC_CHANNELS.aiProviderModels),
        getProviderStatus: () => ipcRenderer.invoke(IPC_CHANNELS.aiProviderStatus),
        getProviderMetrics: () => ipcRenderer.invoke(IPC_CHANNELS.aiProviderMetrics),
        getOverlayState: () => ipcRenderer.invoke(IPC_CHANNELS.overlayGetState),
        setOverlayVisible: (visible) => ipcRenderer.invoke(IPC_CHANNELS.overlaySetVisible, visible),
        setOverlayDocked: (docked) => ipcRenderer.invoke(IPC_CHANNELS.overlaySetDocked, docked),
        setOverlayVoiceMode: (voiceMode) => ipcRenderer.invoke(IPC_CHANNELS.overlaySetVoiceMode, voiceMode),
        setOverlayQuickAutomation: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.overlaySetQuickAutomation, enabled),
        getShortcutBindings: () => ipcRenderer.invoke(IPC_CHANNELS.overlayGetShortcuts),
        setShortcutBindings: (bindings) => ipcRenderer.invoke(IPC_CHANNELS.overlaySetShortcuts, bindings),
        getWorkspaceContext: () => ipcRenderer.invoke(IPC_CHANNELS.overlayWorkspaceContext),
        searchCommandPalette: (query) => ipcRenderer.invoke(IPC_CHANNELS.overlayCommandPaletteSearch, query),
        startChatStream: (input) => {
            safeLogger.info('[JARVIS_PRELOAD] startChatStream → main', input.streamId);
            return ipcRenderer.invoke(IPC_CHANNELS.aiChatStartStream, input);
        },
        cancelChatStream: (streamId) => ipcRenderer.invoke(IPC_CHANNELS.aiChatCancelStream, streamId),
        onChatStreamEvent: (listener) => {
            const handler = (_event, payload) => {
                listener(payload);
            };
            ipcRenderer.on(IPC_CHANNELS.aiChatStreamEvent, handler);
            return () => ipcRenderer.off(IPC_CHANNELS.aiChatStreamEvent, handler);
        },
    },
    memory: {
        getRecentCommands: () => ipcRenderer.invoke(IPC_CHANNELS.memoryRecentCommands),
        getOverview: () => ipcRenderer.invoke(IPC_CHANNELS.memoryOverview),
        getCommandStats: () => ipcRenderer.invoke(IPC_CHANNELS.memoryCommandStats),
        getWorkflows: () => ipcRenderer.invoke(IPC_CHANNELS.memoryWorkflows),
        getProjects: () => ipcRenderer.invoke(IPC_CHANNELS.memoryProjects),
        getSuggestions: () => ipcRenderer.invoke(IPC_CHANNELS.memorySuggestions),
        executeWorkflow: (workflowId) => ipcRenderer.invoke(IPC_CHANNELS.workflowExecute, workflowId),
        getWorkflowSchedules: () => ipcRenderer.invoke(IPC_CHANNELS.workflowSchedules),
        getWorkflowRuns: () => ipcRenderer.invoke(IPC_CHANNELS.workflowRuns),
        generateWorkflowFromPrompt: (prompt) => ipcRenderer.invoke(IPC_CHANNELS.workflowGenerate, prompt),
    },
    execution: {
        getRecentLogs: () => ipcRenderer.invoke(IPC_CHANNELS.executionRecentLogs),
        getRecentTasks: () => ipcRenderer.invoke(IPC_CHANNELS.executionRecentTasks),
    },
    voice: {
        transcribe: (input) => ipcRenderer.invoke(IPC_CHANNELS.voiceTranscribe, input),
    },
    screen: {
        capture: (source) => ipcRenderer.invoke(IPC_CHANNELS.screenCapture, source),
        getActiveWindow: () => ipcRenderer.invoke(IPC_CHANNELS.screenActiveWindow),
        analyzeLatest: () => ipcRenderer.invoke(IPC_CHANNELS.screenAnalyze),
        getHistory: () => ipcRenderer.invoke(IPC_CHANNELS.screenHistory),
    },
    automation: {
        selfTest: () => ipcRenderer.invoke(IPC_CHANNELS.automationSelfTest),
        directExec: (type, params) => ipcRenderer.invoke(IPC_CHANNELS.automationDirectExec, { type, params }),
        windowSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.automationWindowSnapshot),
    },
    aiHealth: {
        getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.aiHealthStatus),
        ping: () => ipcRenderer.invoke(IPC_CHANNELS.aiHealthPing),
        setApiKey: (key) => ipcRenderer.invoke(IPC_CHANNELS.aiSetApiKey, key),
    },
};
try {
    contextBridge.exposeInMainWorld('jarvis', api);
    contextBridge.exposeInMainWorld('electron', api);
    safeLogger.info('[JARVIS_PRELOAD] contextBridge exposed window.jarvis + window.electron (same API)');
    safeLogger.info('[JARVIS_PRELOAD] bridge top-level keys:', Object.keys(api).join(', '));
}
catch (err) {
    safeLogger.error('[JARVIS_PRELOAD] contextBridge.exposeInMainWorld failed — renderer will have no IPC bridge', err);
}
