const APP_WHITELIST = {
    'vs code': 'code',
    vscode: 'code',
    chrome: 'chrome',
    edge: 'msedge',
};
const SAFE_COMMAND_WHITELIST = new Set(['dir', 'whoami', 'date', 'echo hello']);
export function resolveWhitelistedApp(name) {
    return APP_WHITELIST[name.trim().toLowerCase()];
}
export function isSafeTerminalCommand(command) {
    return SAFE_COMMAND_WHITELIST.has(command.trim().toLowerCase());
}
