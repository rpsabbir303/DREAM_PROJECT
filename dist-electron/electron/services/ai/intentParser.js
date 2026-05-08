const URL_PATTERN = /(https?:\/\/[^\s]+)/i;
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
        return { intent: 'open_folder', target, confidence: 0.8, rawInput: normalized };
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
    return {
        intent: 'unknown',
        target: normalized,
        confidence: 0.2,
        rawInput: normalized,
    };
}
