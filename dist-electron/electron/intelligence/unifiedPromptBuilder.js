import { randomUUID } from 'node:crypto';
import { MultimodalIntelligenceError } from './multimodalErrors.js';
function formatSection(title, body) {
    return `### ${title}\n${body.trim()}`;
}
function formatCrossModal(hints) {
    if (hints.length === 0)
        return '';
    const lines = hints.map((h, i) => `${i + 1}. ${h.summary} (modalities: ${h.relatedModalities.join(', ')})`);
    return formatSection('Cross-modal reasoning (heuristic)', lines.join('\n'));
}
/**
 * Assembles provider-ready messages with a single consolidated multimodal system preamble.
 */
export function buildUnifiedPromptMessages(params) {
    try {
        const { baseSystemPrompt, prioritizedSlices, crossModalHints, history, userMessage, understanding } = params;
        const modalitySections = prioritizedSlices.map((s) => formatSection(`${s.chunk.title} [${s.chunk.kind}]`, s.chunk.content));
        const cross = formatCrossModal(crossModalHints);
        const unifiedContext = [
            `Intent routing: ${understanding.intent} (confidence ${understanding.confidence.toFixed(2)}).`,
            understanding.reasoning ? `Intent reasoning: ${understanding.reasoning}` : '',
            ...modalitySections,
            cross,
        ]
            .filter(Boolean)
            .join('\n\n');
        const systemPreamble = {
            id: randomUUID(),
            role: 'system',
            content: [baseSystemPrompt, '', '=== Unified multimodal context ===', unifiedContext].join('\n'),
            createdAt: new Date().toISOString(),
        };
        return [systemPreamble, ...history.slice(-12), userMessage];
    }
    catch (cause) {
        throw new MultimodalIntelligenceError('prompt', 'Failed to build unified prompt messages', cause);
    }
}
