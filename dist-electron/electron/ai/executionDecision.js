function buildRefusalAddendum() {
    return [
        'POLICY: This user message appears to request destructive, privileged, or unsafe system actions.',
        'Do NOT use any desktop tools. Reply in 2–4 sentences: refuse calmly, explain why, and suggest a safe alternative (e.g. use Settings, recycle bin, or a specific documented backup flow).',
    ].join(' ');
}
function buildClarifyAddendum(understanding) {
    const hint = understanding.continuityHint
        ? `Optional context from recent chat: a path or workspace may be "${understanding.continuityHint}".`
        : 'No confident path was inferred from recent chat.';
    return [
        'POLICY: The user request is actionable but ambiguous.',
        'Do NOT use desktop tools until the user specifies a concrete app name, https URL, or absolute folder path.',
        `Ask exactly ONE short clarifying question (mention what you need: path, app name, or URL). ${hint}`,
    ].join(' ');
}
function buildVagueDeletionAddendum() {
    return [
        'POLICY: The message may involve deleting or cleaning files.',
        'Do NOT use desktop tools. Ask which folder they mean and confirm they want non-destructive help only.',
    ].join(' ');
}
function buildToolsEnabledAddendum(understanding) {
    const parts = [
        'TOOL ROUTING: Prefer open_app for programs, open_url for web links, open_folder for directories, run_terminal_command only for whitelisted read/dev commands.',
        'After any tool result, answer in natural language (success: confirm plainly, e.g. "VS Code launched successfully."; failure: explain what likely went wrong, e.g. app not found or invalid path).',
    ];
    if (understanding.ambiguity === 'medium' && understanding.actionRequired) {
        parts.push('If you call a tool, prefix your reply with one short assumption (e.g. which folder you used) so the user can correct you.');
    }
    if (understanding.continuityHint) {
        parts.push(`CONTINUITY: If the user refers to "the project", "that folder", or "here", prefer open_folder with "${understanding.continuityHint}" when it matches their goal.`);
    }
    if (understanding.intent === 'run_safe_command' && understanding.continuityHint) {
        parts.push(`For run commands, the user may intend the project at "${understanding.continuityHint}" — only whitelisted commands exist; if none apply, tell them to run dev scripts from that folder in their own terminal.`);
    }
    return parts.join(' ');
}
function summarizeDecision(mode, understanding) {
    const conf = understanding.executionConfidence ?? understanding.confidence;
    switch (mode) {
        case 'tools_disabled_refuse':
            return 'Safety: destructive or privileged patterns detected — tools disabled for this turn.';
        case 'tools_disabled_clarify':
            if (understanding.ambiguity === 'high') {
                return 'Clarify: action target is ambiguous — ask for path, URL, or app name before tools.';
            }
            return 'Clarify: possible file cleanup or deletion — confirm scope; tools disabled until clear.';
        default:
            return `Execute: tools allowed (confidence ${conf.toFixed(2)}).`;
    }
}
/**
 * Deterministic gate before the LLM: refuse unsafe, clarify vague paths, otherwise allow tools (OpenAI only).
 */
export function resolveCommandIntelDecision(understanding, userInput) {
    if (understanding.riskLevel === 'blocked') {
        return {
            mode: 'tools_disabled_refuse',
            systemAddendum: buildRefusalAddendum(),
            decisionSummary: summarizeDecision('tools_disabled_refuse', understanding),
        };
    }
    const vagueDestructive = /\b(delete|remove|erase|trash|wipe)\b/i.test(userInput) && /\b(file|folder|directories?|everything|old)\b/i.test(userInput);
    if (vagueDestructive) {
        return {
            mode: 'tools_disabled_clarify',
            systemAddendum: buildVagueDeletionAddendum(),
            decisionSummary: summarizeDecision('tools_disabled_clarify', understanding),
        };
    }
    if (understanding.actionRequired && understanding.ambiguity === 'high') {
        return {
            mode: 'tools_disabled_clarify',
            systemAddendum: buildClarifyAddendum(understanding),
            decisionSummary: summarizeDecision('tools_disabled_clarify', understanding),
        };
    }
    return {
        mode: 'tools_enabled',
        systemAddendum: buildToolsEnabledAddendum(understanding),
        decisionSummary: summarizeDecision('tools_enabled', understanding),
    };
}
