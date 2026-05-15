/**
 * Plugin Registry — Phase 8
 *
 * Central execution router. Accepts a ResolvedIntent from nlpRouter,
 * dispatches to the appropriate plugin, and returns a uniform PluginResult.
 *
 * Plugin domains:
 *   app.*      → appPlugin
 *   file.*     → fileSystemAgent
 *   folder.*   → fileSystemAgent
 *   system.*   → systemControlAgent
 *   browser.*  → browserAgent
 *   window.*   → windowManager
 *   agent.*    → agentPlanner (Gemini-backed)
 */
import { safeLogger } from '../main/safeLogger.js';
import { runtimeState } from '../system/runtimeState.js';
import { executeAppIntent } from './apps/appPlugin.js';
import { openFolder, createFolder, createFile, deleteFile, moveFile, renameFile, searchFiles, emptyRecycleBin, } from './files/fileSystemAgent.js';
import { volumeMute, volumeSet, volumeIncrease, volumeDecrease, setBrightness, takeScreenshot, lockScreen, shutdownPC, restartPC, sleepPC, setWifi, setBluetooth, getClipboard, clearClipboard, } from './system/systemControlAgent.js';
import { openUrl, openSite, webSearch, youtubeSearch } from './browser/browserAgent.js';
import { listWindows, getActiveWindow } from '../system/windowManager.js';
import { planGoalWithGemini } from '../ai/agentPlanner.js';
import { pressKey, typeText } from '../system/keyboardController.js';
// ─── File / Folder dispatch ───────────────────────────────────────────────────
async function executeFileIntent(intent) {
    const p = intent.params;
    switch (intent.type) {
        case 'folder.open': return openFolder(p.folder ?? p.path ?? '');
        case 'folder.create': return createFolder(p.name ?? '');
        case 'file.create': return createFile(p.name ?? '');
        case 'file.delete': {
            const target = p.target ?? p.path ?? '';
            return deleteFile(target);
        }
        case 'file.rename': return renameFile(p.target ?? '', p.newName ?? '');
        case 'file.move': return moveFile(p.src ?? '', p.dest ?? '');
        case 'file.search': {
            const { ok, results, message } = await searchFiles(p.query ?? '');
            if (!ok)
                return { ok, message };
            if (results.length === 0)
                return { ok: true, message };
            const list = results.slice(0, 8).map((r) => `• ${r.name} — ${r.path}`).join('\n');
            return { ok: true, message: `${message}\n\n${list}`, data: results };
        }
        default:
            return { ok: false, message: `Unknown file intent: ${intent.type}` };
    }
}
// ─── System dispatch ──────────────────────────────────────────────────────────
async function executeSystemIntent(intent) {
    const p = intent.params;
    switch (intent.type) {
        case 'system.volume': {
            const action = p.action ?? 'mute';
            if (action === 'mute')
                return volumeMute();
            if (action === 'set')
                return volumeSet(Number(p.level ?? 50));
            if (action === 'increase')
                return volumeIncrease(Number(p.amount ?? 5));
            if (action === 'decrease')
                return volumeDecrease(Number(p.amount ?? 5));
            return volumeMute();
        }
        case 'system.brightness': return setBrightness(Number(p.level ?? 75));
        case 'system.screenshot': return takeScreenshot();
        case 'system.lock': return lockScreen();
        case 'system.sleep': return sleepPC();
        case 'system.shutdown': return shutdownPC();
        case 'system.restart': return restartPC();
        case 'system.wifi': return setWifi(p.action === 'on');
        case 'system.bluetooth': return setBluetooth(p.action === 'on');
        case 'system.recycle': return emptyRecycleBin();
        case 'system.clipboard': {
            if (p.action === 'clear')
                return clearClipboard();
            return getClipboard();
        }
        default:
            return { ok: false, message: `Unknown system intent: ${intent.type}` };
    }
}
// ─── Browser dispatch ─────────────────────────────────────────────────────────
async function executeBrowserIntent(intent) {
    const p = intent.params;
    switch (intent.type) {
        case 'browser.url': {
            if (p.site)
                return openSite(p.site);
            return openUrl(p.url ?? '');
        }
        case 'browser.search': {
            const engine = p.engine ?? 'google';
            if (engine === 'youtube')
                return youtubeSearch(p.query ?? '');
            return webSearch(p.query ?? '', engine);
        }
        default:
            return { ok: false, message: `Unknown browser intent: ${intent.type}` };
    }
}
// ─── Window dispatch ──────────────────────────────────────────────────────────
async function executeWindowIntent(intent) {
    switch (intent.type) {
        case 'window.list': {
            // Prefer in-memory cache (fast), fallback to shell
            const cached = runtimeState.runningApps;
            if (cached.length > 0) {
                const list = cached.slice(0, 15)
                    .map((a) => `• **${a.appName}** (${a.processName})`)
                    .join('\n');
                return { ok: true, message: `Currently running apps:\n\n${list}`, data: cached };
            }
            const windows = await listWindows();
            if (windows.length === 0)
                return { ok: true, message: 'No windows found.' };
            const list = windows.slice(0, 15).map((w) => `• ${w.processName} — ${w.title}`).join('\n');
            return { ok: true, message: `Running windows:\n\n${list}`, data: windows };
        }
        case 'window.info': {
            // Use live cache first (Phase 6 — runtimeState), shell fallback
            const cached = runtimeState.activeWindow;
            if (cached) {
                const lines = [
                    `You're currently using **${cached.appName}**.`,
                    `Window title: "${cached.title}"`,
                    `Process: ${cached.processName}  •  PID: ${cached.pid}`,
                    `State: ${cached.windowState}`,
                ];
                return { ok: true, message: lines.join('\n'), data: cached };
            }
            const active = await getActiveWindow();
            if (!active)
                return { ok: true, message: 'Could not detect the active window.' };
            return {
                ok: true,
                message: `You're currently using **${active.title}** (${active.processName}).`,
                data: active,
            };
        }
        default:
            return { ok: false, message: `Unknown window intent: ${intent.type}` };
    }
}
// ─── Keyboard dispatch ────────────────────────────────────────────────────────
async function executeKeyboardIntent(intent) {
    const p = intent.params;
    switch (intent.type) {
        case 'keyboard.shortcut': {
            const key = p.key ?? '';
            if (!key)
                return { ok: false, message: 'No key specified.' };
            return pressKey(key);
        }
        case 'keyboard.type': {
            const text = p.text ?? '';
            if (!text)
                return { ok: false, message: 'No text to type.' };
            return typeText(text);
        }
        default:
            return { ok: false, message: `Unknown keyboard intent: ${intent.type}` };
    }
}
// ─── Agent dispatch ───────────────────────────────────────────────────────────
async function executeAgentIntent(intent) {
    const goal = intent.params.goal ?? intent.rawInput;
    const plan = await planGoalWithGemini(goal);
    return {
        ok: true,
        message: `I'll work on that. Planning: ${plan.reasoning}\n\nSteps:\n${plan.steps.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}`,
        data: plan,
    };
}
// ─── Main entry point ─────────────────────────────────────────────────────────
/**
 * Execute a resolved intent through the appropriate plugin.
 * This is the single execution gateway — all plugins route through here.
 */
export async function executeIntent(intent) {
    const domain = intent.type.split('.')[0];
    safeLogger.info(`[JARVIS_AUTOMATION] executeIntent type=${intent.type} domain=${domain}`);
    try {
        switch (domain) {
            case 'app': return await executeAppIntent(intent);
            case 'file':
            case 'folder': return await executeFileIntent(intent);
            case 'system': return await executeSystemIntent(intent);
            case 'browser': return await executeBrowserIntent(intent);
            case 'window': return await executeWindowIntent(intent);
            case 'agent': return await executeAgentIntent(intent);
            case 'keyboard': return await executeKeyboardIntent(intent);
            default:
                return { ok: false, message: `No plugin registered for domain "${domain}".` };
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        safeLogger.error('[PLUGIN_REGISTRY] unhandled error', intent.type, msg);
        return { ok: false, message: `Command failed: ${msg.slice(0, 200)}` };
    }
}
