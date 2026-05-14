import { parseIntent } from './intentParser.js';
import { estimateTargetAmbiguity, extractPathHintsFromHistory, formatRecentCommandsForPrompt, pickPrimaryContinuityHint, stripCommandPreamble, summarizeGoal, } from './commandContext.js';
import { triageUserRiskLevel } from './riskTriage.js';
const MONITORING_PATTERN = /(cpu|ram|memory|uptime|disk|gpu|system status)/i;
/** Intents that map to desktop execution (open app, URL, path, safe terminal). */
const EXECUTABLE_INTENTS = new Set([
    'open_application',
    'open_url',
    'open_folder',
    'open_project',
    'run_safe_command',
]);
function enrichUnderstanding(input, parsed, base, context) {
    const riskLevel = triageUserRiskLevel(input);
    const pathHints = context?.history ? extractPathHintsFromHistory(context.history) : [];
    const continuityHint = pickPrimaryContinuityHint(pathHints);
    const ambiguity = base.actionRequired
        ? estimateTargetAmbiguity(base.intent, parsed.target ?? '', continuityHint)
        : 'low';
    const ambiguityFactor = ambiguity === 'low' ? 1 : ambiguity === 'medium' ? 0.85 : 0.58;
    const safe = riskLevel !== 'blocked';
    const executionConfidence = base.actionRequired
        ? Math.min(0.99, base.confidence * ambiguityFactor * (safe ? 1 : 0))
        : Math.min(0.99, base.confidence);
    const recentLines = context?.recentCommands ? formatRecentCommandsForPrompt(context.recentCommands) : [];
    const reasoningParts = [base.reasoning];
    if (continuityHint)
        reasoningParts.push(`Continuity path candidate from chat: ${continuityHint}.`);
    if (recentLines.length)
        reasoningParts.push(`Recent commands (newest first): ${recentLines.slice(0, 3).join(' | ')}.`);
    return {
        ...base,
        goalSummary: summarizeGoal(parsed, base.intent),
        ambiguity,
        riskLevel,
        continuityHint: continuityHint ?? null,
        executionConfidence,
        reasoning: reasoningParts.join(' '),
    };
}
export function parseChatUnderstanding(input, context) {
    const parsed = parseIntent(input);
    if (EXECUTABLE_INTENTS.has(parsed.intent)) {
        const base = {
            intent: parsed.intent,
            target: parsed.target || null,
            actionRequired: true,
            confidence: parsed.confidence,
            reasoning: 'Matched executable desktop command pattern.',
        };
        return enrichUnderstanding(input, parsed, base, context);
    }
    if (parsed.intent === 'system_monitoring' || MONITORING_PATTERN.test(input) || MONITORING_PATTERN.test(stripCommandPreamble(input))) {
        const base = {
            intent: 'system_monitoring',
            target: null,
            actionRequired: false,
            confidence: 0.84,
            reasoning: 'System telemetry question — answer in chat without executing shell actions.',
        };
        return enrichUnderstanding(input, parsed, base, context);
    }
    const base = {
        intent: 'chat_general',
        target: null,
        actionRequired: false,
        confidence: parsed.intent === 'unknown' ? 0.35 : 0.62,
        reasoning: 'General conversational request.',
    };
    return enrichUnderstanding(input, parsed, base, context);
}
