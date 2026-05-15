import { safeLogger } from '../main/safeLogger.js';
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
import { listWindows, getActiveWindow } from '../system/windowManager.js';
import { listRunningApps } from '../system/processManager.js';
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
            safeLogger.warn('[JARVIS_AI] aiChatStartStream validation failed:', msg, payload);
            if (sid && !event.sender.isDestroyed()) {
                event.sender.send(IPC_CHANNELS.aiChatStreamEvent, {
                    streamId: sid,
                    type: 'error',
                    data: { message: `Invalid chat request: ${msg}` },
                });
            }
            throw parsed.error;
        }
        safeLogger.info('[JARVIS_IPC] aiChatStartStream accepted', parsed.data.streamId, 'len=', parsed.data.input.length);
        await chatEngine.startStream(parsed.data, event.sender);
        return { accepted: true };
    });
    ipcMain.handle(IPC_CHANNELS.aiChatCancelStream, async (_event, streamId) => {
        return { cancelled: chatEngine.cancelStream(streamId) };
    });
    ipcMain.handle(IPC_CHANNELS.voiceTranscribe, async () => {
        safeLogger.warn('[JARVIS_VOICE] voiceTranscribe IPC disabled — text chat MVP (no Whisper)');
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
    // ── Phase 10: Desktop Agent Status ───────────────────────────────────────
    ipcMain.handle(IPC_CHANNELS.desktopAgentWindows, async () => {
        return listWindows();
    });
    ipcMain.handle(IPC_CHANNELS.desktopAgentRunningApps, async () => {
        return listRunningApps();
    });
    ipcMain.handle(IPC_CHANNELS.desktopAgentActiveWindow, async () => {
        return getActiveWindow();
    });
    // ── Automation Self-Test ──────────────────────────────────────────────────
    ipcMain.handle(IPC_CHANNELS.automationSelfTest, async () => {
        const { runAutomationSelfTest } = await import('../system/automationSelfTest.js');
        return runAutomationSelfTest();
    });
    // ── Direct Execution Bypass (dev/debug) ───────────────────────────────────
    // Calls executeIntent directly — bypasses NLP entirely.
    // Payload: { type, params }  where type is an NlpIntentType
    ipcMain.handle(IPC_CHANNELS.automationDirectExec, async (_event, payload) => {
        safeLogger.info(`[JARVIS_DIRECT] direct-exec type=${payload.type} params=${JSON.stringify(payload.params)}`);
        const { executeIntent } = await import('../plugins/pluginRegistry.js');
        try {
            const result = await executeIntent({
                type: payload.type,
                params: payload.params,
                rawInput: `[direct:${payload.type}]`,
                displayLabel: `Direct: ${payload.type}`,
                confidence: 1.0,
                riskLevel: 'low',
            });
            safeLogger.info(`[JARVIS_DIRECT] result ok=${result.ok} message="${result.message}"`);
            return result;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            safeLogger.error(`[JARVIS_DIRECT] threw: ${msg}`);
            return { ok: false, message: `Threw: ${msg.slice(0, 300)}` };
        }
    });
    // ── AI Health ─────────────────────────────────────────────────────────────
    ipcMain.handle(IPC_CHANNELS.aiHealthStatus, async () => {
        const { getAIStatus } = await import('../ai/aiHealthService.js');
        return getAIStatus();
    });
    ipcMain.handle(IPC_CHANNELS.aiHealthPing, async () => {
        const { pingProvider } = await import('../ai/aiHealthService.js');
        return pingProvider();
    });
    ipcMain.handle(IPC_CHANNELS.aiSetApiKey, async (_event, key) => {
        if (!key || typeof key !== 'string' || key.trim().length < 12) {
            return { ok: false, message: 'Invalid API key format.' };
        }
        // Write key into .env at runtime so next restart picks it up,
        // AND inject into process.env immediately so current session works.
        const trimmed = key.trim();
        process.env.GEMINI_API_KEY = trimmed;
        // Also persist to .env file (project root in dev and packaged app path)
        try {
            const { readFileSync, writeFileSync, existsSync } = await import('node:fs');
            const { join, resolve, dirname } = await import('node:path');
            const { app } = await import('electron');
            const { fileURLToPath } = await import('node:url');
            const ipcDir = dirname(fileURLToPath(import.meta.url));
            const projectEnv = resolve(ipcDir, '../../..', '.env');
            const envPath = existsSync(projectEnv) ? projectEnv : join(app.getAppPath(), '.env');
            let content = '';
            try {
                content = readFileSync(envPath, 'utf-8');
            }
            catch { /* file may not exist yet */ }
            if (content.includes('GEMINI_API_KEY=')) {
                content = content.replace(/^GEMINI_API_KEY=.*/m, `GEMINI_API_KEY=${trimmed}`);
            }
            else {
                content = content.trimEnd() + `\nGEMINI_API_KEY=${trimmed}\n`;
            }
            writeFileSync(envPath, content, 'utf-8');
            const { reloadDesktopEnvironment } = await import('../main/env.js');
            reloadDesktopEnvironment();
        }
        catch (e) {
            safeLogger.warn('[JARVIS_IPC] aiSetApiKey: could not persist to .env:', e instanceof Error ? e.message : String(e));
        }
        // Kick off a live ping to confirm it works
        const { pingProvider } = await import('../ai/aiHealthService.js');
        const status = await pingProvider();
        return { ok: status.status === 'online', status };
    });
    // ── Live Window Snapshot + App Dump ─────────────────────────────────────
    ipcMain.handle(IPC_CHANNELS.automationWindowSnapshot, async () => {
        const results = [];
        // Source 1: DesktopStateEngine cache
        try {
            const { getTrackedWindows } = await import('../system/desktopStateEngine.js');
            const cached = getTrackedWindows();
            results.push({
                source: 'DesktopStateEngine (cache)',
                windows: cached.map((w) => ({
                    title: w.title,
                    processName: w.processName,
                    pid: w.pid,
                    hwnd: w.hwnd,
                    isFocused: w.isFocused,
                    isMinimized: w.isMinimized,
                })),
            });
        }
        catch (e) {
            results.push({ source: 'DesktopStateEngine (FAILED)', windows: [] });
            safeLogger.error('[JARVIS_SNAPSHOT] DSE error:', e);
        }
        // Source 2: Live PowerShell query
        try {
            const { exec } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const execAsync = promisify(exec);
            const ps = `Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne '' } | ForEach-Object { Write-Output "$($_.MainWindowHandle.ToInt64())|$($_.Id)|$($_.ProcessName)|$($_.MainWindowTitle)" }`;
            const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`, { windowsHide: true, timeout: 12_000 });
            const psWindows = stdout.trim().split('\n').filter(Boolean).map((line) => {
                const parts = line.trim().split('|');
                return {
                    title: parts.slice(3).join('|').trim(),
                    processName: parts[2]?.trim() ?? '',
                    pid: Number(parts[1]),
                    hwnd: Number(parts[0]),
                };
            });
            results.push({ source: 'Live PowerShell Get-Process', windows: psWindows });
        }
        catch (e) {
            results.push({ source: 'Live PowerShell (FAILED)', windows: [] });
            safeLogger.error('[JARVIS_SNAPSHOT] PS error:', e);
        }
        // Source 3: Discovery registry dump
        try {
            const { dumpDiscoveredApps, getDiscoveryCount, isDiscoveryReady } = await import('../system/appDiscovery.js');
            const dump = dumpDiscoveredApps(100);
            results.push({
                source: `Discovery Registry (ready=${isDiscoveryReady()}, total=${getDiscoveryCount()})`,
                windows: dump.map((a) => ({
                    title: a.name,
                    processName: a.processName ?? '(uwp/unknown)',
                    pid: 0,
                    hwnd: undefined,
                })),
            });
        }
        catch (e) {
            results.push({ source: `Discovery Registry (FAILED: ${e})`, windows: [] });
        }
        return results;
    });
}
