import { safeLogger } from '../../main/safeLogger.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { canUseConfiguredGemini, getEffectiveGeminiApiKey, resolveGeminiModel } from '../geminiEnv.js';
import { recordSuccess, recordFailure, recordRetry } from '../aiHealthService.js';
const GEMINI_TIMEOUT_MS = Math.min(Math.max(30_000, Number(process.env.GEMINI_FETCH_TIMEOUT_MS ?? 120_000)), 600_000);
// ─── Retry config ─────────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1_000; // 1 s, 2 s, 4 s
function isRetryable(error) {
    const msg = error.message.toLowerCase();
    // Retry on network/server errors, not on auth or bad-request errors
    if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('403'))
        return false;
    if (msg.includes('invalid') || msg.includes('400'))
        return false;
    if (msg.includes('quota') || msg.includes('429'))
        return false;
    return true; // network timeout, 5xx, ECONNRESET, etc.
}
async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function redactHttpUrls(message) {
    return message.replace(/\bhttps?:\/\/[^\s]+/gi, '[sdk-endpoint]');
}
function buildPrompt(messages) {
    return messages.map((m) => `${m.role}: ${m.content}`).join('\n');
}
// ─── Startup ping ─────────────────────────────────────────────────────────────
export async function initializeJarvisGeminiOnStartup() {
    const resolvedModel = resolveGeminiModel();
    safeLogger.info('[JARVIS_GEMINI] initializing — model=', resolvedModel);
    if (!canUseConfiguredGemini()) {
        safeLogger.warn('[JARVIS_GEMINI] GEMINI_API_KEY missing or placeholder in .env');
        safeLogger.warn('[JARVIS_GEMINI] → Get a free key at https://aistudio.google.com/apikey');
        safeLogger.warn('[JARVIS_GEMINI] → Add it to .env: GEMINI_API_KEY=AIza...');
        recordFailure('GEMINI_API_KEY not set in .env');
        return;
    }
    const apiKey = getEffectiveGeminiApiKey();
    const t0 = Date.now();
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: resolvedModel });
        const result = await model.generateContent('ping', { timeout: 15_000 });
        void result.response.text();
        recordSuccess(Date.now() - t0);
        safeLogger.info('[JARVIS_GEMINI] startup ping ok — AI brain ONLINE');
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        recordFailure(redactHttpUrls(msg));
        safeLogger.error('[JARVIS_GEMINI] startup ping failed:', redactHttpUrls(msg));
    }
}
// ─── Chat completion with retry + backoff ─────────────────────────────────────
export async function completeGeminiChat(params) {
    const apiKey = getEffectiveGeminiApiKey();
    if (!apiKey) {
        const raw = process.env.GEMINI_API_KEY?.trim();
        const err = raw
            ? 'GEMINI_API_KEY looks like a placeholder — paste a real key from https://aistudio.google.com/apikey'
            : 'GEMINI_API_KEY is missing — add it to .env and restart';
        recordFailure(err);
        throw new Error(err);
    }
    const resolvedModel = resolveGeminiModel();
    const prompt = buildPrompt(params.messages).trim();
    if (!prompt) {
        throw new Error('Gemini: empty prompt (no messages).');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: resolvedModel });
    let lastError = new Error('Unknown error');
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (params.signal?.aborted)
            throw new Error('Request cancelled.');
        if (attempt > 0) {
            recordRetry();
            const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
            safeLogger.info(`[JARVIS_GEMINI] retrying in ${backoff}ms (attempt ${attempt}/${MAX_RETRIES})`);
            await sleep(backoff);
        }
        const t0 = Date.now();
        try {
            const result = await model.generateContent(prompt, {
                signal: params.signal,
                timeout: GEMINI_TIMEOUT_MS,
            });
            const text = result.response.text().trim();
            recordSuccess(Date.now() - t0);
            safeLogger.info('[JARVIS_GEMINI] chat ok, chars=', text.length);
            return text;
        }
        catch (error) {
            const caught = error instanceof Error ? error : new Error(String(error));
            lastError = caught;
            const clean = redactHttpUrls(caught.message);
            safeLogger.warn(`[JARVIS_GEMINI] attempt ${attempt} failed: ${clean}`);
            if (!isRetryable(caught)) {
                recordFailure(clean);
                throw caught;
            }
        }
    }
    const finalMsg = redactHttpUrls(lastError.message);
    recordFailure(finalMsg);
    throw new Error(`Gemini request failed after ${MAX_RETRIES} retries: ${finalMsg}`, { cause: lastError });
}
