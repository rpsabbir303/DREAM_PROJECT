import { randomUUID } from 'node:crypto';
import { MultimodalIntelligenceError } from './multimodalErrors.js';
/**
 * Persists a text-only multimodal session digest into the semantic knowledge index for later retrieval.
 * Does not store images or covert audio — strictly derived text.
 */
export function persistMultimodalSessionSummary(params) {
    const { memory, userInput, assistantSummary, preferences } = params;
    if (!preferences.persistSessionToKnowledge)
        return;
    try {
        const digest = [
            'Multimodal session digest (text-only).',
            `User: ${userInput.slice(0, 2000)}`,
            `Assistant (excerpt): ${assistantSummary.slice(0, 2000)}`,
            `Preferences snapshot: semantic=${preferences.includeSemanticMemory}, observability=${preferences.includeObservability}, screen=${preferences.includeScreenAnalyses}`,
        ].join('\n');
        memory.indexKnowledgeChunk({
            id: randomUUID(),
            sourceType: 'note',
            sourceRef: `multimodal:${new Date().toISOString()}`,
            content: digest,
            metadata: {
                kind: 'multimodal_session',
                privacy: 'text_only',
            },
            indexedAt: new Date().toISOString(),
        });
    }
    catch (cause) {
        throw new MultimodalIntelligenceError('persistence', 'Failed to index multimodal session summary', cause);
    }
}
