import { randomUUID } from 'node:crypto';
import { BASIC_CHAT_SYSTEM_PROMPT } from '../../shared/ai/basicChatMvp.js';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels.js';
import { tryRunDesktopAutomationFromUserText } from '../automation/appControl.js';
import { routeProvider } from './providerRouter.js';
import { resolveGeminiModel } from './geminiEnv.js';
import { runJarvisGeminiBasic } from './geminiJarvisPipeline.js';
/**
 * Basic MVP chat: one assistant reply per user turn via Google Gemini (non-streaming).
 */
export class ChatEngine {
    memoryRepository;
    activeStreams = new Map();
    constructor(memoryRepository) {
        this.memoryRepository = memoryRepository;
    }
    async startStream(input, sender) {
        const controller = new AbortController();
        this.activeStreams.set(input.streamId, controller);
        const emit = (event) => {
            try {
                if (sender.isDestroyed()) {
                    console.warn('[JARVIS_AI] skip emit — sender destroyed:', event.type);
                    return;
                }
                sender.send(IPC_CHANNELS.aiChatStreamEvent, event);
            }
            catch (err) {
                console.warn('[JARVIS_AI] emit failed:', event.type, err);
            }
        };
        try {
            emit({ streamId: input.streamId, type: 'start' });
            console.info('[JARVIS_AI] chat turn start', input.streamId, 'chars=', input.input.length);
            const userMessage = this.memoryRepository.addChatMessage({ role: 'user', content: input.input });
            const automation = await tryRunDesktopAutomationFromUserText(input.input);
            if (automation.handled) {
                const finalText = automation.message;
                const startedLocal = Date.now();
                console.info('[JARVIS_AI] desktop automation (no LLM)', input.streamId);
                emit({
                    streamId: input.streamId,
                    type: 'provider',
                    data: {
                        provider: 'gemini',
                        model: resolveGeminiModel(),
                        reason: 'Local desktop automation (no LLM).',
                        isOffline: true,
                    },
                });
                emit({
                    streamId: input.streamId,
                    type: 'delta',
                    data: { chunk: finalText },
                });
                this.memoryRepository.addChatMessage({ role: 'assistant', content: finalText });
                emit({
                    streamId: input.streamId,
                    type: 'complete',
                    data: { finalText },
                });
                console.info('[JARVIS_AI] automation turn complete', input.streamId, 'ms=', Date.now() - startedLocal);
                return;
            }
            const settings = this.memoryRepository.getAiSettings();
            const decision = routeProvider(input.input, settings);
            console.info('[JARVIS_AI] provider', decision.provider, decision.model, decision.reason);
            emit({
                streamId: input.streamId,
                type: 'provider',
                data: decision,
            });
            const messages = [
                {
                    id: randomUUID(),
                    role: 'system',
                    content: BASIC_CHAT_SYSTEM_PROMPT,
                    createdAt: new Date().toISOString(),
                },
                ...input.history.slice(-10),
                userMessage,
            ];
            const startedAt = Date.now();
            let finalText;
            try {
                finalText = await runJarvisGeminiBasic({
                    messages,
                    streamId: input.streamId,
                    signal: controller.signal,
                    onDelta: (chunk) => {
                        emit({
                            streamId: input.streamId,
                            type: 'delta',
                            data: { chunk },
                        });
                    },
                });
                if (!finalText.trim()) {
                    throw new Error('Gemini returned an empty reply. Check GEMINI_MODEL and API quotas.');
                }
                this.memoryRepository.addAiProviderMetric({
                    provider: decision.provider,
                    model: decision.model,
                    latencyMs: Date.now() - startedAt,
                    inputChars: input.input.length,
                    outputChars: finalText.length,
                    createdAt: new Date().toISOString(),
                });
                this.memoryRepository.addChatMessage({ role: 'assistant', content: finalText });
                emit({
                    streamId: input.streamId,
                    type: 'complete',
                    data: { finalText },
                });
                console.info('[JARVIS_AI] chat turn complete', input.streamId, 'outChars=', finalText.length);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown chat error';
                console.error('[JARVIS_AI] chat LLM error', input.streamId, message, error);
                emit({
                    streamId: input.streamId,
                    type: 'error',
                    data: { message },
                });
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Chat pipeline failed before LLM';
            console.error('[JARVIS_AI] chat pipeline error', input.streamId, message, error);
            emit({
                streamId: input.streamId,
                type: 'error',
                data: { message },
            });
        }
        finally {
            this.activeStreams.delete(input.streamId);
        }
    }
    cancelStream(streamId) {
        const controller = this.activeStreams.get(streamId);
        if (!controller)
            return false;
        controller.abort();
        this.activeStreams.delete(streamId);
        return true;
    }
}
