import { readProcessEnv } from './openAiEnv.js';
const GEMINI_PLACEHOLDER_MARKERS = [
    'your_gemini',
    'your-api-key',
    'changeme',
    'placeholder',
    'example_key',
    'replace_me',
    'replace-with-your',
];
/** True when the key is non-empty and not an obvious template. */
export function looksLikeGeminiApiKey(key) {
    const t = key.trim();
    if (t.length < 12)
        return false;
    const lower = t.toLowerCase();
    if (GEMINI_PLACEHOLDER_MARKERS.some((m) => lower.includes(m)))
        return false;
    return true;
}
export function getEffectiveGeminiApiKey() {
    const k = readProcessEnv('GEMINI_API_KEY');
    if (!k)
        return null;
    return looksLikeGeminiApiKey(k) ? k : null;
}
export function canUseConfiguredGemini() {
    return getEffectiveGeminiApiKey() !== null;
}
export function resolveGeminiModel() {
    return readProcessEnv('GEMINI_MODEL') ?? 'gemini-2.0-flash';
}
