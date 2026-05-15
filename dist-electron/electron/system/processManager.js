/**
 * Process Manager — Phase 1
 *
 * Detects, lists, and terminates Windows processes.
 * All operations are async and non-blocking.
 */
import { safeLogger } from '../main/safeLogger.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
const execAsync = promisify(exec);
// ─── Running Process Detection ───────────────────────────────────────────────
/** Returns true if the given image name is currently running. */
export async function isProcessRunning(imageName) {
    try {
        const { stdout } = await execAsync(`cmd /c tasklist /FI "IMAGENAME eq ${imageName}" /NH`, { windowsHide: true, timeout: 6_000 });
        return stdout.toLowerCase().includes(imageName.toLowerCase());
    }
    catch {
        return false;
    }
}
/** Returns first matching image name from a list that is currently running, or null. */
export async function detectFirstRunning(imageNames) {
    for (const name of imageNames) {
        if (await isProcessRunning(name)) {
            safeLogger.info('[JARVIS_PROC] detected', name);
            return name;
        }
    }
    return null;
}
/** PowerShell fallback: find process whose main window title contains `title`. */
export async function detectByWindowTitle(title) {
    try {
        const ps = `Get-Process | Where-Object { $_.MainWindowTitle -match '${title.replace(/'/g, "\\'")}' } | Select-Object -First 1 -ExpandProperty ProcessName`;
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { windowsHide: true, timeout: 10_000 });
        const found = stdout.trim();
        return found ? `${found}.exe` : null;
    }
    catch {
        return null;
    }
}
// ─── Process Listing ─────────────────────────────────────────────────────────
/** Returns a list of all running processes with window titles (GUI apps only). */
export async function listRunningApps() {
    try {
        const ps = `
      Get-Process | Where-Object { $_.MainWindowTitle -ne '' } |
      Select-Object Name,Id,SessionName,WorkingSet |
      ConvertTo-Json -Compress
    `;
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/\n\s*/g, ' ')}"`, { windowsHide: true, timeout: 10_000 });
        const raw = JSON.parse(stdout.trim());
        return raw.map((p) => ({
            name: `${p.Name}.exe`,
            pid: p.Id,
            sessionName: p.SessionName ?? '',
            memoryKb: Math.round(p.WorkingSet / 1024),
        }));
    }
    catch {
        return [];
    }
}
/** Returns all processes with their window titles. */
export async function listWindowedProcesses() {
    try {
        const ps = `
      Get-Process |
      Where-Object { $_.MainWindowTitle -ne '' } |
      Select-Object @{N='name';E={$_.ProcessName}},@{N='pid';E={$_.Id}},@{N='title';E={$_.MainWindowTitle}} |
      ConvertTo-Json -Compress
    `;
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/\n\s*/g, ' ')}"`, { windowsHide: true, timeout: 10_000 });
        const text = stdout.trim();
        if (!text || text === 'null')
            return [];
        const raw = JSON.parse(text);
        const arr = Array.isArray(raw) ? raw : [raw];
        return arr.map((p) => ({ name: String(p.name), pid: Number(p.pid), title: String(p.title) }));
    }
    catch {
        return [];
    }
}
/** Kill a process by its image name. */
export async function killByImageName(imageName) {
    try {
        const { stdout, stderr } = await execAsync(`cmd /c taskkill /F /IM ${imageName}`, { windowsHide: true, timeout: 10_000 });
        const out = (stdout + stderr).toLowerCase();
        if (out.includes('not found') || out.includes('no tasks')) {
            return { ok: true, message: `Process ${imageName} was not running.` };
        }
        return { ok: true, message: `Terminated ${imageName}.` };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const low = msg.toLowerCase();
        if (low.includes('not found') || low.includes('no tasks')) {
            return { ok: true, message: `Process ${imageName} was not running.` };
        }
        return { ok: false, message: `Could not terminate ${imageName}: ${msg.slice(0, 140)}` };
    }
}
/** Kill a process by PID. */
export async function killByPid(pid) {
    try {
        await execAsync(`cmd /c taskkill /F /PID ${pid}`, { windowsHide: true, timeout: 8_000 });
        return { ok: true, message: `Terminated PID ${pid}.` };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: `Could not terminate PID ${pid}: ${msg.slice(0, 140)}` };
    }
}
