import { resolveGeminiModel } from './geminiEnv.js';
import { completeGeminiChat } from './providers/geminiProvider.js';
/**
 * Basic Gemini chat: one non-streaming completion; one `onDelta` with full text.
 */
export async function runJarvisGeminiBasic(params) {
    console.info('[JARVIS_GEMINI] basic chat (SDK, non-stream)', {
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
    console.info('[JARVIS_GEMINI] basic chat success, chars=', text.length);
    return text;
}
