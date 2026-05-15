/**
 * Runtime Process Graph
 *
 * Maintains a live in-memory graph of all running Windows processes,
 * including parent/child relationships obtained via WMI (CimInstance).
 *
 * This resolves the "launcher problem": apps like Discord, Steam, VS Code, and
 * many Electron apps spawn a parent process that immediately exits, leaving a
 * detached child as the real process. The graph lets us trace those chains.
 *
 * Refresh cycle: every 8 seconds (WMI is slow — don't over-poll it).
 * Available immediately via getProcessGraph() after the first refresh.
 *
 * Usage:
 *   import { startProcessGraph, getProcessGraph, findRootPid } from './runtimeProcessGraph.js'
 *   startProcessGraph()
 *   const root = findRootPid(somePid)
 */
import { safeLogger } from '../main/safeLogger.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
const execAsync = promisify(exec);
// ─── State ────────────────────────────────────────────────────────────────────
let _graph = new Map();
let _timer = null;
const REFRESH_MS = 8_000;
// ─── PowerShell query ─────────────────────────────────────────────────────────
const PROCESS_GRAPH_PS = [
    `Get-CimInstance Win32_Process`,
    `| Select-Object ProcessId, Name, ParentProcessId, ExecutablePath`,
    `| ForEach-Object {`,
    `  "$($_.ProcessId)|$($_.Name)|$($_.ParentProcessId)|$($_.ExecutablePath)"`,
    `}`,
].join(' ');
async function fetchProcessGraph() {
    try {
        const safe = PROCESS_GRAPH_PS.replace(/"/g, '\\"');
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${safe}"`, { windowsHide: true, timeout: 15_000 });
        const graph = new Map();
        for (const raw of stdout.trim().split('\n')) {
            const line = raw.trim();
            if (!line)
                continue;
            const [pidStr, name, parentStr, exePath] = line.split('|');
            const pid = Number(pidStr);
            if (!pid || !name)
                continue;
            graph.set(pid, {
                pid,
                name: name.trim().replace(/\.exe$/i, '').toLowerCase(),
                parentPid: Number(parentStr) || null,
                exePath: exePath?.trim() || null,
                children: [],
            });
        }
        // Populate children arrays
        for (const node of graph.values()) {
            if (node.parentPid && graph.has(node.parentPid)) {
                graph.get(node.parentPid).children.push(node.pid);
            }
        }
        return graph;
    }
    catch {
        return _graph; // return stale on error
    }
}
// ─── Public API ───────────────────────────────────────────────────────────────
/** Start periodic process graph refresh. Safe to call multiple times. */
export function startProcessGraph() {
    if (_timer)
        return;
    // Eager first fetch
    fetchProcessGraph().then((g) => {
        _graph = g;
        safeLogger.info(`[JARVIS_STATE] process graph built — ${g.size} processes`);
    }).catch(() => undefined);
    _timer = setInterval(async () => {
        _graph = await fetchProcessGraph();
    }, REFRESH_MS);
}
/** Stop the refresh timer (call on app quit). */
export function stopProcessGraph() {
    if (_timer) {
        clearInterval(_timer);
        _timer = null;
    }
}
/** Return the current process graph snapshot. */
export function getProcessGraph() {
    return _graph;
}
/**
 * Walk up the parent chain from `pid` until we reach a root or a well-known
 * launcher, then return that root PID.
 * Useful for Electron apps where the spawned PID is a helper, not the main window.
 */
export function findRootPid(pid, maxDepth = 8) {
    let current = pid;
    let depth = 0;
    while (depth++ < maxDepth) {
        const node = _graph.get(current);
        if (!node?.parentPid)
            break;
        const parent = _graph.get(node.parentPid);
        if (!parent)
            break;
        // Stop at system processes
        if (['system', 'services', 'svchost', 'lsass', 'explorer'].includes(parent.name))
            break;
        current = node.parentPid;
    }
    return current;
}
/**
 * Get all PIDs that belong to the same "app" as the given PID.
 * Walks up to find the root, then collects all descendants of that root.
 */
export function getAppPidGroup(pid) {
    const root = findRootPid(pid);
    const group = new Set();
    function collect(p) {
        group.add(p);
        const node = _graph.get(p);
        for (const child of node?.children ?? [])
            collect(child);
    }
    collect(root);
    return [...group];
}
/**
 * Find PIDs whose image name matches `processName` (case-insensitive, .exe optional).
 */
export function findPidsByName(processName) {
    const target = processName.toLowerCase().replace(/\.exe$/i, '');
    const found = [];
    for (const node of _graph.values()) {
        if (node.name === target)
            found.push(node.pid);
    }
    return found;
}
/** True if any process with the given name is currently in the graph. */
export function isProcessInGraph(processName) {
    return findPidsByName(processName).length > 0;
}
