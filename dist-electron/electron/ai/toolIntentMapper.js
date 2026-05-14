/**
 * Maps an OpenAI function name + JSON arguments string to a ParsedIntent for ExecutionManager.
 */
export function parsedIntentFromToolCall(functionName, argumentsJson) {
    let args = {};
    try {
        args = JSON.parse(argumentsJson || '{}');
    }
    catch {
        return null;
    }
    const pick = (...keys) => {
        for (const key of keys) {
            const value = args[key];
            if (typeof value === 'string' && value.trim().length > 0)
                return value.trim();
        }
        return '';
    };
    const raw = `tool:${functionName}`;
    const target = pick('target', 'url', 'path', 'command');
    switch (functionName) {
        case 'open_app':
            return { intent: 'open_application', target, confidence: 1, rawInput: raw, mvpKind: 'open_app' };
        case 'open_url':
            return { intent: 'open_url', target, confidence: 1, rawInput: raw, mvpKind: 'open_url' };
        case 'open_folder':
            return { intent: 'open_folder', target, confidence: 1, rawInput: raw, mvpKind: 'open_folder' };
        case 'run_terminal_command': {
            const command = pick('command');
            return { intent: 'run_safe_command', target: command, confidence: 1, rawInput: raw, mvpKind: 'run_command' };
        }
        default:
            return null;
    }
}
