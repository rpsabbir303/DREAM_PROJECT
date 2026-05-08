import { parseIntent } from './intentParser.js';
const MONITORING_PATTERN = /(cpu|ram|memory|uptime|disk|gpu|system status)/i;
export function parseChatUnderstanding(input) {
    const parsed = parseIntent(input);
    if (parsed.intent !== 'unknown') {
        return {
            intent: parsed.intent,
            target: parsed.target || null,
            actionRequired: true,
            confidence: parsed.confidence,
            reasoning: 'Matched command intent pattern.',
        };
    }
    if (MONITORING_PATTERN.test(input)) {
        return {
            intent: 'system_monitoring',
            target: null,
            actionRequired: false,
            confidence: 0.84,
            reasoning: 'Detected system telemetry question.',
        };
    }
    return {
        intent: 'chat_general',
        target: null,
        actionRequired: false,
        confidence: 0.6,
        reasoning: 'General conversational request.',
    };
}
