import { shell } from 'electron';
import { spawn } from 'node:child_process';
const APP_WHITELIST = {
    'vs code': 'code',
    vscode: 'code',
    chrome: 'chrome',
    edge: 'msedge',
};
const SAFE_COMMAND_WHITELIST = new Set(['dir', 'whoami', 'date', 'echo hello']);
function normalize(input) {
    return input.trim().toLowerCase();
}
export async function executeIntent(intent) {
    switch (intent.intent) {
        case 'open_url': {
            const url = intent.target;
            if (!/^https?:\/\//i.test(url)) {
                throw new Error('Blocked: only http/https URLs are allowed.');
            }
            await shell.openExternal(url);
            return `Opened URL: ${url}`;
        }
        case 'open_folder': {
            const result = await shell.openPath(intent.target);
            if (result)
                throw new Error(result);
            return `Opened folder: ${intent.target}`;
        }
        case 'open_application': {
            const appCommand = APP_WHITELIST[normalize(intent.target)];
            if (!appCommand) {
                throw new Error('Application is not in the safe whitelist.');
            }
            spawn(appCommand, [], { detached: true, stdio: 'ignore', shell: true }).unref();
            return `Launched application: ${intent.target}`;
        }
        case 'run_safe_command': {
            const command = normalize(intent.target);
            if (!SAFE_COMMAND_WHITELIST.has(command)) {
                throw new Error('Command blocked by safe mode policy.');
            }
            spawn(command, [], { detached: true, stdio: 'ignore', shell: true }).unref();
            return `Executed command: ${intent.target}`;
        }
        default:
            throw new Error('Could not map instruction to a safe system action.');
    }
}
