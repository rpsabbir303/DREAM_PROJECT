import { stripCommandPreamble } from './commandContext.js';
const URL_PATTERN = /(https?:\/\/[^\s]+)/i;
const MONITORING_PATTERN = /(cpu|ram|memory|uptime|disk|gpu|system status)/i;
/** Map internal intent enum to MVP JSON-style labels (e.g. open_application → open_app). */
function toMvpKind(intent) {
    switch (intent) {
        case 'open_application':
            return 'open_app';
        case 'open_url':
            return 'open_url';
        case 'open_folder':
        case 'open_project':
            return 'open_folder';
        case 'run_safe_command':
            return 'run_command';
        case 'system_monitoring':
            return 'system_status';
        case 'chat_general':
            return 'chat';
        default:
            return 'unknown';
    }
}
function build(intent, target, confidence, rawInput) {
    return { intent, target, confidence, rawInput, mvpKind: toMvpKind(intent) };
}
/** Common site names → https URL when user says "open youtube" etc. */
const WEB_SHORTCUTS = {
    youtube: 'https://www.youtube.com',
    'youtube.com': 'https://www.youtube.com',
    google: 'https://www.google.com',
    github: 'https://github.com',
    gmail: 'https://mail.google.com',
};
/**
 * Lightweight rule-based intent classifier for the MVP desktop assistant.
 */
export function parseIntent(input) {
    const originalTrim = input.trim();
    const normalized = stripCommandPreamble(originalTrim);
    const lower = normalized.toLowerCase();
    if (lower.startsWith('open ') && URL_PATTERN.test(normalized)) {
        const match = normalized.match(URL_PATTERN);
        return build('open_url', match?.[0] ?? normalized, 0.94, originalTrim);
    }
    if (lower.startsWith('open ')) {
        const rest = normalized.replace(/^open\s+/i, '').trim();
        const restKey = rest.toLowerCase();
        if (WEB_SHORTCUTS[restKey]) {
            return build('open_url', WEB_SHORTCUTS[restKey], 0.92, originalTrim);
        }
    }
    if (lower.startsWith('open ') && lower.includes('project')) {
        let target = normalized.replace(/^open\s+/i, '').trim();
        target = target.replace(/^(my|the|our)\s+/i, '').trim();
        target = target.replace(/\s+(project|repo)\s*$/i, '').trim();
        if (!target)
            target = normalized.replace(/^open\s+/i, '').trim();
        return build('open_project', target, 0.84, originalTrim);
    }
    if (lower.startsWith('open ') && /\b(folder|directory)\b/i.test(normalized)) {
        const target = normalized.replace(/^open\s+(my\s+)?/i, '').replace(/\s+(folder|directory)\b/i, '').trim();
        return build('open_folder', target, 0.82, originalTrim);
    }
    if (lower.startsWith('open ')) {
        const target = normalized.replace(/^open\s+/i, '').trim();
        return build('open_application', target, 0.86, originalTrim);
    }
    if ((lower.startsWith('launch ') || lower.startsWith('start ')) && !URL_PATTERN.test(normalized)) {
        const target = normalized.replace(/^(launch|start)\s+/i, '').trim();
        if (target.length > 0 && !MONITORING_PATTERN.test(target)) {
            return build('open_application', target, 0.83, originalTrim);
        }
    }
    if (lower.startsWith('run ') || lower.startsWith('execute ')) {
        const target = normalized.replace(/^(run|execute)\s+/i, '').trim();
        return build('run_safe_command', target, 0.75, originalTrim);
    }
    if (MONITORING_PATTERN.test(normalized)) {
        return build('system_monitoring', '', 0.82, originalTrim);
    }
    if (normalized.length > 0) {
        return build('chat_general', '', 0.58, originalTrim);
    }
    return build('unknown', originalTrim, 0.2, originalTrim);
}
