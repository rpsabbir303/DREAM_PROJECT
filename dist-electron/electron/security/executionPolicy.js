import { resolveApplicationCommand } from '../system/applicationRegistry.js';
/**
 * Substrings / regexes that must never run — even if the rest of the line looks benign.
 * Keep this list conservative for the MVP “safe terminal” surface.
 */
export const DANGEROUS_COMMAND_PATTERNS = [
    /rm\s+(-rf|-fr)\b/i,
    /\brm\s+-r\b/i,
    /\bmkfs\b/i,
    /\bdd\s+if=/i,
    /:()\{\s*:\|:&\s*\};:/, // fork bomb
    /\bshutdown\b/i,
    /\breboot\b/i,
    /\bformat\s+[c-z]:/i,
    /\bdel\s+\/f/i,
    /\brmdir\s+\/s/i,
    /\breg(\.exe)?\s+add\b/i,
    /\breg(\.exe)?\s+delete\b/i,
    /\bnet(\.exe)?\s+user\b/i,
    /\bpowershell(.exe)?\s+.*-encodedcommand/i,
    /\bcurl\b.+\|\s*(sh|bash|pwsh)/i,
    /\bwget\b.+\|\s*(sh|bash)/i,
    /\bgit\s+push\b/i,
    /\bgit\s+reset\s+--hard\b/i,
    /\bchmod\s+777\b/i,
    /\bchown\b/i,
    /\bsudo\b/i,
    /\bsu\s+/i,
    />\s*\/dev\//,
    /\|\s*sh\b/i,
];
/** Exact commands allowed after trim + inner space normalization (see normalizeTerminalCommand). */
const SAFE_COMMAND_EXACT = new Set([
    // navigation / info
    'ls',
    'dir',
    'pwd',
    'whoami',
    'date',
    'echo hello',
    // git (read-only-ish)
    'git status',
    'git branch',
    'git diff',
    'git log -1',
    // npm / node (common dev loop)
    'npm run dev',
    'npm run build',
    'npm run test',
    'npm install',
    'npm ls',
    'npm outdated',
    // yarn / pnpm equivalents
    'yarn install',
    'yarn dev',
    'pnpm install',
    'pnpm run dev',
].map((c) => normalizeTerminalCommand(c)));
export function normalizeTerminalCommand(command) {
    return command.trim().replace(/\s+/g, ' ').toLowerCase();
}
export function containsDangerousShellPattern(command) {
    return DANGEROUS_COMMAND_PATTERNS.some((re) => re.test(command));
}
/** True when the command is on the MVP whitelist and passes the dangerous-pattern gate. */
export function isSafeTerminalCommand(command) {
    const raw = command.trim();
    if (!raw)
        return false;
    if (containsDangerousShellPattern(raw))
        return false;
    return SAFE_COMMAND_EXACT.has(normalizeTerminalCommand(raw));
}
/** Legacy name used by actionExecutor — resolves friendly app names to a shell launch token / path. */
export function resolveWhitelistedApp(name) {
    return resolveApplicationCommand(name);
}
