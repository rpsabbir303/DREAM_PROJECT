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
    const model = resolveGeminiModel();
    if (!canUseConfiguredGemini()) {
        return {
            provider: 'gemini',
            model,
            reason: 'AI provider unavailable — desktop automation still works.',
            isOffline: true,
        };
    }
    return {
        provider: 'gemini',
        model,
        reason: 'Jarvis uses Google Gemini only.',
        isOffline: false,
    };
}
