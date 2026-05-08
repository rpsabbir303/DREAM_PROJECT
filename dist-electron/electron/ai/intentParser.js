const URL_PATTERN = /(https?:\/\/[^\s]+)/i;
const MONITORING_PATTERN = /(cpu|ram|memory|uptime|disk|gpu|system status)/i;
export function parseIntent(input) {
    const normalized = input.trim();
    const lower = normalized.toLowerCase();
    if (lower.startsWith('open ') && URL_PATTERN.test(normalized)) {
        const match = normalized.match(URL_PATTERN);
        return {
            intent: 'open_url',
            target: match?.[0] ?? normalized,
            confidence: 0.94,
            rawInput: normalized,
        };
    }
    if (lower.startsWith('open ') && lower.includes('project')) {
        const target = normalized.replace(/open\s+(my\s+)?/i, '').trim();
        return { intent: 'open_project', target, confidence: 0.84, rawInput: normalized };
    }
    if (lower.startsWith('open ')) {
        const target = normalized.replace(/^open\s+/i, '').trim();
        return {
            intent: 'open_application',
            target,
            confidence: 0.86,
            rawInput: normalized,
        };
    }
    if (lower.startsWith('run ') || lower.startsWith('execute ')) {
        const target = normalized.replace(/^(run|execute)\s+/i, '').trim();
        return {
            intent: 'run_safe_command',
            target,
            confidence: 0.75,
            rawInput: normalized,
        };
    }
    if (MONITORING_PATTERN.test(normalized)) {
        return {
            intent: 'system_monitoring',
            target: '',
            confidence: 0.82,
            rawInput: normalized,
        };
    }
    if (normalized.length > 0) {
        return {
            intent: 'chat_general',
            target: '',
            confidence: 0.58,
            rawInput: normalized,
        };
    }
    return {
        intent: 'unknown',
        target: normalized,
        confidence: 0.2,
        rawInput: normalized,
    };
}
