import fs from 'node:fs';
import path from 'node:path';
import { containsDangerousShellPattern, isSafeTerminalCommand } from './executionPolicy.js';
import { expandUserPathAlias } from '../system/userPathAliases.js';
function isAllowedHttpUrl(value) {
    return /^https?:\/\//i.test(value.trim());
}
function isValidExistingPath(raw) {
    const normalized = path.resolve(expandUserPathAlias(raw));
    return fs.existsSync(normalized);
}
/**
 * Validates a parsed intent **before** touching the shell or filesystem openers.
 */
export function validateIntent(intent) {
    const target = intent.target.trim();
    if (intent.intent === 'open_url') {
        if (!isAllowedHttpUrl(target))
            return { ok: false, reason: 'Only http/https URLs are allowed.' };
        if (containsDangerousShellPattern(target))
            return { ok: false, reason: 'URL looks suspicious.' };
        return { ok: true };
    }
    if (intent.intent === 'open_folder' || intent.intent === 'open_project') {
        const expanded = expandUserPathAlias(target);
        if (!isValidExistingPath(expanded))
            return { ok: false, reason: 'Path does not exist on disk.' };
        return { ok: true };
    }
    if (intent.intent === 'run_safe_command') {
        if (containsDangerousShellPattern(target)) {
            return { ok: false, reason: 'Dangerous command pattern blocked.' };
        }
        if (!isSafeTerminalCommand(target)) {
            return { ok: false, reason: 'Command is not in the MVP safe whitelist.' };
        }
        return { ok: true };
    }
    return { ok: true };
}
