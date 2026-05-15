import { GoogleGenerativeAI } from '@google/generative-ai';
import { canUseConfiguredGemini, getEffectiveGeminiApiKey, resolveGeminiModel } from '../geminiEnv.js';
const GEMINI_TIMEOUT_MS = Math.min(Math.max(30_000, Number(process.env.GEMINI_FETCH_TIMEOUT_MS ?? 120_000)), 600_000);
/** Redact SDK error strings so logs do not echo full Google endpoint URLs. */
function redactHttpUrls(message) {
    return message.replace(/\bhttps?:\/\/[^\s]+/gi, '[sdk-endpoint]');
}
function buildPrompt(messages) {
    return messages.map((m) => `${m.role}: ${m.content}`).join('\n');
}
/**
 * Gemini via **only** `@google/generative-ai` — no `fetch`, no manual URLs, no `baseUrl` / `apiVersion` in app code.
 * HTTP is performed inside the SDK.
 */
export async function initializeJarvisGeminiOnStartup() {
    const resolvedModel = resolveGeminiModel();
    console.log('[JARVIS_GEMINI] SDK ONLY MODE');
    console.log('[JARVIS_GEMINI] MODEL =', resolvedModel);
    if (!canUseConfiguredGemini()) {
        console.warn('[JARVIS_GEMINI] Startup skipped — GEMINI_API_KEY missing or placeholder in `.env`');
        return;
    }
    const apiKey = getEffectiveGeminiApiKey();
    if (!apiKey) {
        console.warn('[JARVIS_GEMINI] Startup skipped — no usable API key');
        return;
    }
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: resolvedModel });
        const result = await model.generateContent('ping', { timeout: Math.min(25_000, GEMINI_TIMEOUT_MS) });
        const text = result.response.text();
        void text;
        console.log('[JARVIS_GEMINI] startup ping ok');
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[JARVIS_GEMINI] startup ping failed:', redactHttpUrls(msg));
    }
}
/**
 * One chat turn: `GoogleGenerativeAI` → `getGenerativeModel` → `generateContent(prompt)` → `response.text()`.
 */
export async function completeGeminiChat(params) {
    const apiKey = getEffectiveGeminiApiKey();
    if (!apiKey) {
        const raw = process.env.GEMINI_API_KEY?.trim();
        if (!raw) {
            throw new Error('GEMINI_API_KEY is missing. Add it to the project root `.env` (see https://aistudio.google.com/apikey).');
        }
        throw new Error('GEMINI_API_KEY is set but looks like a placeholder — use a real key from Google AI Studio.');
    }
    const resolvedModel = resolveGeminiModel();
    const prompt = buildPrompt(params.messages).trim();
    if (!prompt) {
        throw new Error('Gemini: empty prompt (no messages).');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: resolvedModel });
    try {
        const result = await model.generateContent(prompt, {
            signal: params.signal,
            timeout: GEMINI_TIMEOUT_MS,
        });
        const text = result.response.text().trim();
        console.log('[JARVIS_GEMINI] chat ok');
        return text;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[JARVIS_GEMINI] chat failed:', redactHttpUrls(msg));
        throw new Error(redactHttpUrls(msg));
    }
}
