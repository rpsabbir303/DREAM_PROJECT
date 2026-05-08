import { spawn } from 'node:child_process';
export async function executeSafeTerminalCommand(command, options = {}) {
    const timeoutMs = options.timeoutMs ?? 15_000;
    const segments = command.split(' ');
    const bin = segments[0];
    const args = segments.slice(1);
    return new Promise((resolve) => {
        const processHandle = spawn(bin, args, { shell: true });
        let output = '';
        let settled = false;
        const finish = (result) => {
            if (settled)
                return;
            settled = true;
            resolve(result);
        };
        const timer = setTimeout(() => {
            processHandle.kill();
            finish({
                ok: false,
                actionType: 'run_terminal',
                message: `Command timed out: ${command}`,
                error: 'timeout',
                output,
            });
        }, timeoutMs);
        processHandle.stdout.on('data', (chunk) => {
            output += String(chunk);
        });
        processHandle.stderr.on('data', (chunk) => {
            output += String(chunk);
        });
        processHandle.on('error', (error) => {
            clearTimeout(timer);
            finish({
                ok: false,
                actionType: 'run_terminal',
                message: `Failed to execute command: ${command}`,
                error: error.message,
                output,
            });
        });
        processHandle.on('close', (code) => {
            clearTimeout(timer);
            finish({
                ok: code === 0,
                actionType: 'run_terminal',
                message: code === 0 ? `Executed command: ${command}` : `Command failed: ${command}`,
                output: output.trim(),
                error: code === 0 ? undefined : `exit_code_${code ?? 'unknown'}`,
            });
        });
    });
}
