import { spawn } from 'node:child_process';
import { resolveApplicationCommand } from './applicationRegistry.js';
export async function launchApplication(target) {
    const command = resolveApplicationCommand(target);
    if (!command) {
        return {
            ok: false,
            actionType: 'open_application',
            message: `Application "${target}" is not in registry.`,
            error: 'application_not_whitelisted',
        };
    }
    spawn(command, [], { detached: true, stdio: 'ignore', shell: true }).unref();
    return {
        ok: true,
        actionType: 'open_application',
        message: `Launched application: ${target}`,
    };
}
