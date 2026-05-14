/**
 * Core JARVIS system prompt: calm, concise, futuristic assistant tone.
 */
export function buildJarvisSystemPrompt(ctx) {
    const memoryBlock = ctx.memoryLines.length > 0
        ? `Recent conversation (trimmed, newest last):\n${ctx.memoryLines.join('\n')}`
        : '';
    const execBlock = ctx.executionDigest?.trim() ? `Desktop state:\n${ctx.executionDigest.trim()}` : '';
    const cmdBlock = ctx.recentCommandLines && ctx.recentCommandLines.length > 0
        ? `Recent desktop commands (newest first, for continuity):\n${ctx.recentCommandLines.join('\n')}`
        : '';
    const goal = ctx.understanding.goalSummary ? `Inferred goal: ${ctx.understanding.goalSummary}` : '';
    const amb = ctx.understanding.ambiguity ?
        `Ambiguity: ${ctx.understanding.ambiguity}. Risk: ${ctx.understanding.riskLevel ?? 'none'}. Execution confidence: ${(ctx.understanding.executionConfidence ?? ctx.understanding.confidence).toFixed(2)}.`
        : '';
    const intel = ctx.intelAddendum?.trim() ?? '';
    const implicit = ctx.implicitContextLine?.trim() ?? '';
    return [
        'You are JARVIS — a calm, precise, futuristic personal desktop copilot.',
        'Be brief and helpful. Prefer action over exposition when the user wants something done.',
        'Never suggest destructive, privileged, or ambiguous shell commands.',
        'When desktop tools are available and allowed, call them instead of guessing whether something opened.',
        `Classifier: intent=${ctx.understanding.intent}, actionRequired=${ctx.understanding.actionRequired}, target=${ctx.understanding.target ?? 'none'}.`,
        goal,
        amb,
        ctx.understanding.continuityHint ?
            `Continuity hint (from recent chat): ${ctx.understanding.continuityHint}`
            : '',
        implicit ? `Implicit context: ${implicit}` : '',
        'If a tool already ran, answer like a human: state success or failure plainly, no robotic filler.',
        'On failure, give one specific next step (e.g. paste full path, check install).',
        intel,
        execBlock,
        cmdBlock,
        memoryBlock,
    ]
        .filter(Boolean)
        .join('\n\n');
}
