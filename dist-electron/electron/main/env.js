import { safeLogger } from './safeLogger.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { canUseConfiguredGemini, resolveGeminiModel } from '../ai/geminiEnv.js';
import { readProcessEnv } from '../ai/openAiEnv.js';
/**
 * Read at call time (not at module load) so parent `cross-env` and dotenv both apply
 * before the first BrowserWindow loads.
 */
export function getDevServerUrl() {
    const raw = process.env.VITE_DEV_SERVER_URL;
    if (typeof raw !== 'string')
        return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
export function isDesktopViteDev() {
    return getDevServerUrl() !== undefined;
}
let envLoaded = false;
/**
 * Loads `.env` into `process.env` for the Electron main process.
 * Vite only injects env for the renderer; Gemini reads keys here (Electron main).
 */
export function loadDesktopEnvironment(force = false) {
    if (envLoaded && !force)
        return;
    envLoaded = true;
    const mainDir = path.dirname(fileURLToPath(import.meta.url));
    const treeEnvPath = path.resolve(mainDir, '../../..', '.env');
    const cwdEnvPath = path.resolve(process.cwd(), '.env');
    safeLogger.info('[JARVIS_ENV] cwd=', process.cwd());
    safeLogger.info('[JARVIS_ENV] candidate .env (from app tree)=', treeEnvPath);
    safeLogger.info('[JARVIS_ENV] candidate .env (from cwd)=', cwdEnvPath);
    const fromTree = config({ path: treeEnvPath });
    if (fromTree.parsed) {
        safeLogger.info('[JARVIS_ENV] loaded tree .env →', Object.keys(fromTree.parsed).length, 'var(s):', Object.keys(fromTree.parsed).join(', '));
    }
    else if (fromTree.error && 'code' in fromTree.error && fromTree.error.code !== 'ENOENT') {
        safeLogger.warn('[JARVIS_ENV] tree .env:', fromTree.error.message);
    }
    else {
        safeLogger.info('[JARVIS_ENV] tree .env not found (ok if you use OS env vars)');
    }
    const fromCwd = config({ path: cwdEnvPath, override: true });
    if (fromCwd.parsed) {
        safeLogger.info('[JARVIS_ENV] cwd .env applied (overrides) →', Object.keys(fromCwd.parsed).length, 'var(s)');
    }
    safeLogger.info('[JARVIS_ENV] VITE_DEV_SERVER_URL after dotenv=', process.env.VITE_DEV_SERVER_URL?.trim() ? process.env.VITE_DEV_SERVER_URL : '(unset)');
    const geminiKey = readProcessEnv('GEMINI_API_KEY');
    const geminiUsable = canUseConfiguredGemini();
    const keyPresentButEmpty = typeof process.env.GEMINI_API_KEY === 'string' && process.env.GEMINI_API_KEY.trim() === '';
    safeLogger.info('[JARVIS_ENV] GEMINI_API_KEY configured=', Boolean(geminiKey), 'usable_for_Gemini=', geminiUsable);
    if (keyPresentButEmpty) {
        safeLogger.warn('[JARVIS_ENV] GEMINI_API_KEY= is empty in .env — paste your key after the equals sign, save the file (Ctrl+S), then restart JARVIS.');
    }
    else if (geminiKey && !geminiUsable) {
        safeLogger.warn('[JARVIS_ENV] GEMINI_API_KEY is set but ignored — replace placeholder with a key from Google AI Studio.');
    }
    safeLogger.info('[JARVIS_ENV] GEMINI_MODEL raw=', process.env.GEMINI_MODEL?.trim() ?? '(unset)', 'resolved=', resolveGeminiModel());
}
/** Reload .env from disk (e.g. after saving the file or setting key in Debug panel). */
export function reloadDesktopEnvironment() {
    envLoaded = false;
    loadDesktopEnvironment(true);
}
// NOTE: loadDesktopEnvironment() is called explicitly from index.ts AFTER
// safeLogger overrides global.console. Do NOT call it here at module-load time.
