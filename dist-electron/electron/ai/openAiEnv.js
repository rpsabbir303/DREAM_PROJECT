/**
 * Central OpenAI env reads + “is this a real secret key?” checks for routing and SDK calls.
 * Placeholder values from `.env.example` must not count as “OpenAI available”.
 */
export function readProcessEnv(name) {
    const value = process.env[name];
    return value && value.trim().length > 0 ? value.trim() : null;
}
const PLACEHOLDER_MARKERS = [
    'your_new_openai',
    'your-api-key',
    'changeme',
    'placeholder',
    'example_key',
    'replace_me',
    'sk-test',
    'sk-xxxx',
    'replace-with-your',
    'sk-replace',
];
/** True when the value looks like an OpenAI API secret (not a template). */
export function looksLikeOpenAiSecretKey(key) {
    const t = key.trim();
    if (t.length < 20)
        return false;
    const lower = t.toLowerCase();
    if (PLACEHOLDER_MARKERS.some((m) => lower.includes(m)))
        return false;
    if (t.startsWith('sk-'))
        return true;
    return false;
}
/** Key from env only if it is non-empty and not an obvious placeholder. */
export function getEffectiveOpenAiApiKey() {
    const k = readProcessEnv('OPENAI_API_KEY');
    if (!k)
        return null;
    return looksLikeOpenAiSecretKey(k) ? k : null;
}
/** Used by provider routing: cloud path only when a real-looking key exists. */
export function canUseConfiguredOpenAi() {
    return getEffectiveOpenAiApiKey() !== null;
}
