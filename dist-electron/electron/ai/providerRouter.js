import { canUseConfiguredGemini, resolveGeminiModel } from './geminiEnv.js';
export async function getProviderStatus() {
    const activeModel = resolveGeminiModel();
    const geminiConfigured = canUseConfiguredGemini();
    return {
        online: geminiConfigured,
        geminiConfigured,
        activeModel,
    };
}
export async function getProviderModels(_settings) {
    const name = resolveGeminiModel();
    return [{ name, provider: 'gemini', available: canUseConfiguredGemini() }];
}
/**
 * Jarvis desktop MVP: Google Gemini only (see `GEMINI_API_KEY`, `GEMINI_MODEL`).
 */
export function routeProvider(_input, _settings) {
    if (!canUseConfiguredGemini()) {
        throw new Error('GEMINI_API_KEY is missing or invalid. Add a real key from Google AI Studio to the project root `.env` (https://aistudio.google.com/apikey).');
    }
    return {
        provider: 'gemini',
        model: resolveGeminiModel(),
        reason: 'Jarvis uses Google Gemini only.',
        isOffline: false,
    };
}
