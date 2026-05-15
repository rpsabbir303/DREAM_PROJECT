import { safeLogger } from '../main/safeLogger.js';
import { sanitizeAppOpenParams } from './nlp/appOpenResolver.js';
import { resolveGeminiModel } from './geminiEnv.js';
import { completeGeminiChat } from './providers/geminiProvider.js';
import { randomUUID } from 'node:crypto';
// ─── Basic chat (streaming) ───────────────────────────────────────────────────
export async function runJarvisGeminiBasic(params) {
    safeLogger.info('[JARVIS_GEMINI] basic chat', {
        streamId: params.streamId,
        model: resolveGeminiModel(),
        messageCount: params.messages.length,
    });
    const text = await completeGeminiChat({
        messages: params.messages,
        signal: params.signal,
    });
    if (!text.trim()) {
        throw new Error('Gemini returned an empty reply.');
    }
    params.onDelta(text);
    safeLogger.info('[JARVIS_GEMINI] basic chat success, chars=', text.length);
    return text;
}
// System prompt for the intent-extraction pass.
// Instructs Gemini to act as a classifier and return typed JSON.
const INTENT_EXTRACTOR_SYSTEM = `You are JARVIS's desktop intent classifier. Your ONLY job is to analyse what the user wants and return a JSON object. No markdown, no explanation, no prose — ONLY JSON.

Pick one of these four shapes:

1. A single desktop action (open, close, focus, minimize, maximize, restart an app; press keys; take screenshot; search; open URL; control system):
{"type":"DESKTOP_ACTION","intent":"app.open","params":{"app":"whatsapp","appKey":"whatsapp"},"confidence":0.93,"requiresConfirmation":false,"displayLabel":"Open WhatsApp"}

2. A multi-step workflow (the user wants several things done in sequence):
{"type":"MULTI_STEP","goal":"work setup","steps":["open chrome","open slack","open cursor","open spotify"],"displayLabel":"Work Setup"}

3. Ambiguous — the target is unclear and you need to ask:
{"type":"CLARIFY","question":"Which browser would you like to close — Chrome, Edge, or Firefox?","candidates":["chrome","edge","firefox"]}

4. General conversation, question, or anything that is NOT a desktop action:
{"type":"CHAT","reply":"<your reply as JARVIS — concise, calm, no filler>"}

Intent values (use exactly these strings):
  app.open  app.close  app.focus  app.minimize  app.maximize  app.restart  app.switch
  keyboard.shortcut  keyboard.type
  system.screenshot  system.lock  system.volume  system.shutdown  system.sleep  system.wifi  system.bluetooth
  browser.url  browser.search
  folder.open  folder.create
  file.search  file.create  file.delete

App name normalisation (always resolve to canonical form):
  "what's app" | "wats app" | "whats app" | "whatsapp desktop" → appKey: "whatsapp"
  "chorme" | "chromee" | "gogle chrome" → appKey: "chrome"
  "vs code" | "vscode" | "visual studio code" → appKey: "vscode"
  "file explorer" | "explorer" | "files" → appKey: "explorer"
  "ms word" | "microsoft word" | "word doc" → appKey: "word"
  "ms excel" | "microsoft excel" → appKey: "excel"
  For any other app: use the normalised lowercase name as "app" param, omit "appKey".

requiresConfirmation = true only for risky actions (shutdown, delete, force kill).
confidence = how certain you are this is the right action (0.0–1.0).

Return ONLY the JSON object. Nothing else.`;
/**
 * Layer 1 — AI Brain.
 * Sends user input to Gemini and gets back a structured intent.
 * Returns null if Gemini is unavailable or returns unparseable output.
 */
export async function extractStructuredIntent(userInput, context, signal) {
    const contextHint = [
        context.activeApp ? `Currently focused: ${context.activeApp}` : null,
        context.recentCommands?.length
            ? `Recent commands: ${context.recentCommands.slice(-3).join(', ')}`
            : null,
    ].filter(Boolean).join('\n');
    const userMessage = contextHint
        ? `[CONTEXT]\n${contextHint}\n\n[USER]\n${userInput}`
        : userInput;
    const messages = [
        {
            id: randomUUID(),
            role: 'system',
            content: INTENT_EXTRACTOR_SYSTEM,
            createdAt: new Date().toISOString(),
        },
        {
            id: randomUUID(),
            role: 'user',
            content: userMessage,
            createdAt: new Date().toISOString(),
        },
    ];
    try {
        const raw = await completeGeminiChat({ messages, signal });
        const trimmed = raw.trim()
            .replace(/^```(?:json)?\n?/, '')
            .replace(/\n?```$/, '')
            .trim();
        const parsed = JSON.parse(trimmed);
        if (!parsed?.type || !['DESKTOP_ACTION', 'MULTI_STEP', 'CLARIFY', 'CHAT'].includes(parsed.type)) {
            safeLogger.warn('[JARVIS_GEMINI] intent extraction: unexpected shape', trimmed.slice(0, 200));
            return null;
        }
        safeLogger.info(`[JARVIS_GEMINI] intent extracted: type=${parsed.type}`);
        if (parsed.type === 'DESKTOP_ACTION') {
            safeLogger.info(`[JARVIS_GEMINI]  intent=${parsed.intent} confidence=${parsed.confidence} label="${parsed.displayLabel}"`);
            if (parsed.intent === 'app.open' && parsed.params) {
                const clean = sanitizeAppOpenParams({
                    app: parsed.params.app,
                    appKey: parsed.params.appKey,
                    discoveryName: parsed.params.discoveryName,
                });
                parsed.params = { ...parsed.params, ...clean };
                if (clean.appKey === 'whatsapp') {
                    parsed.displayLabel = 'Open WhatsApp';
                }
            }
        }
        return parsed;
    }
    catch (e) {
        safeLogger.warn('[JARVIS_GEMINI] intent extraction parse error:', e instanceof Error ? e.message : String(e));
        return null;
    }
}
