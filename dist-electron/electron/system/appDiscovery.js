/**
 * Universal App Discovery
 *
 * Scans installed + running apps from four sources:
 *   1. Start Menu shortcuts (.lnk → exe path via WScript.Shell)
 *   2. Windows Registry    (Uninstall keys HKLM + HKCU + WOW64)
 *   3. UWP / Store apps    (Get-AppxPackage)
 *   4. Running processes   (Get-Process, also tasklist fallback)
 *
 * Each scanner runs in isolation with individual error logging so a failure
 * in one source never silences the others.
 *
 * Logging: [JARVIS_DISCOVERY] prefix — see %TEMP%/jarvis-debug.log
 */
import { safeLogger } from '../main/safeLogger.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const execAsync = promisify(exec);
/** When true, only log scan started + scan completed (no per-source spam). */
const QUIET_DISCOVERY = true;
let _diagRan = false;
function dlog(...args) {
    if (!QUIET_DISCOVERY)
        safeLogger.info(...args);
}
function dwarn(...args) {
    safeLogger.warn(...args);
}
function derror(...args) {
    safeLogger.error(...args);
}
// ─── State ────────────────────────────────────────────────────────────────────
let _registry = [];
let _indexed = false;
let _scanPromise = null;
const REFRESH_INTERVAL_MS = 5 * 60_000;
let _refreshTimer = null;
// ─── Helpers ──────────────────────────────────────────────────────────────────
function norm(s) {
    return s.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function buildAliases(name) {
    const base = norm(name);
    const words = base.split(' ').filter(Boolean);
    const set = new Set([base]);
    // Without version suffixes
    const noVer = words.filter((w) => !/^\d+(\.\d+)?$/.test(w)).join(' ');
    if (noVer && noVer !== base)
        set.add(noVer);
    // Drop company prefix if 3+ words
    if (words.length >= 3)
        set.add(words.slice(1).join(' '));
    if (words.length >= 2)
        set.add(words.slice(0, -1).join(' '));
    if (words[0] && words[0].length >= 3)
        set.add(words[0]);
    const acronym = words.map((w) => w[0]).join('');
    if (acronym.length >= 2 && acronym.length <= 5)
        set.add(acronym);
    const fused = words.join('');
    if (fused.length >= 4 && fused !== base)
        set.add(fused);
    return [...set].filter(Boolean);
}
// Prepend to EVERY script: force UTF-8 output so Node.js exec reads it correctly
// on any Windows locale (including non-Latin code pages like Bengali, CJK, etc.)
const PS_ENCODING_HEADER = `
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
`.trim();
/**
 * Run a PowerShell script by writing it to a temp .ps1 file.
 * Prepends UTF-8 encoding setup so output is readable on any Windows locale.
 * Returns { stdout, stderr, exitCode } — NEVER throws.
 * Logs the exact error if PS fails so we can see why.
 */
async function runPS(label, script, timeoutMs = 25_000) {
    const tmpFile = join(tmpdir(), `jarvis_${randomUUID()}.ps1`);
    try {
        // UTF-8 BOM + encoding header + script
        const content = '\uFEFF' + PS_ENCODING_HEADER + '\n' + script;
        await writeFile(tmpFile, content, 'utf-8');
        const { stdout, stderr } = await execAsync(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`, { windowsHide: true, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' });
        const outTrimmed = stdout.trim();
        const errTrimmed = stderr.trim();
        dlog(`[JARVIS_PS] ${label} → ${outTrimmed.split('\n').length} lines` +
            (errTrimmed ? ` | stderr: ${errTrimmed.slice(0, 200)}` : ''));
        return { stdout: outTrimmed, stderr: errTrimmed, exitCode: 0, error: null };
    }
    catch (e) {
        const err = e;
        const msg = err.message ?? String(e);
        // execAsync throws if exit code != 0, but stdout may still have content
        const stdout = (err.stdout ?? '').trim();
        const stderr = (err.stderr ?? '').trim();
        const exitCode = typeof err.code === 'number' ? err.code : -1;
        derror(`[JARVIS_PS] ${label} FAILED exitCode=${exitCode}`);
        derror(`[JARVIS_PS] ${label} error=${msg.slice(0, 300)}`);
        if (stderr)
            derror(`[JARVIS_PS] ${label} stderr=${stderr.slice(0, 300)}`);
        if (stdout)
            dlog(`[JARVIS_PS] ${label} partial stdout=${stdout.slice(0, 200)}`);
        // Return partial stdout if any (PS may still have output before failing)
        return { stdout, stderr, exitCode, error: msg.slice(0, 300) };
    }
    finally {
        unlink(tmpFile).catch(() => undefined);
    }
}
// ─── Source 1: Start Menu ─────────────────────────────────────────────────────
//
// Uses WScript.Shell to resolve .lnk shortcut targets.
// Falls back to shortcut base name + no exe if COM fails.
const START_MENU_SCRIPT = `
$shell = $null
try { $shell = New-Object -ComObject WScript.Shell -ErrorAction Stop } catch { Write-Output "SHELL_ERR=$_" }
$dirs = @(
  [Environment]::GetFolderPath('CommonStartMenu'),
  [Environment]::GetFolderPath('StartMenu')
)
Write-Output "SM_DIRS=$($dirs -join ';')"
foreach ($dir in $dirs) {
  if (-not (Test-Path $dir)) { Write-Output "SM_SKIP=$dir"; continue }
  $lnks = Get-ChildItem -Path $dir -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue
  Write-Output "SM_DIR_COUNT=$($dir)|$($lnks.Count)"
  foreach ($lnk in $lnks) {
    if ($shell) {
      try {
        $sc  = $shell.CreateShortcut($lnk.FullName)
        $tgt = $sc.TargetPath
        if ($tgt -and $tgt -match '\.exe$') {
          Write-Output "APP=$($lnk.BaseName)|$tgt"
          continue
        }
      } catch {}
    }
    Write-Output "APP=$($lnk.BaseName)|"
  }
}
`;
async function scanStartMenu() {
    const { stdout, error } = await runPS('startMenu', START_MENU_SCRIPT, 20_000);
    if (error && !stdout) {
        dwarn(`[JARVIS_DISCOVERY] startMenu FAILED: ${error}`);
        return [];
    }
    const apps = [];
    for (const raw of stdout.split('\n')) {
        const line = raw.trim();
        // Skip diagnostic lines, only parse APP= lines
        if (!line.startsWith('APP='))
            continue;
        const rest = line.slice(4); // drop "APP="
        const pipe = rest.indexOf('|');
        if (pipe === -1)
            continue;
        const name = rest.slice(0, pipe).trim();
        const exePath = rest.slice(pipe + 1).trim();
        if (!name || name.length < 2)
            continue;
        const processName = exePath.toLowerCase().endsWith('.exe')
            ? exePath.split('\\').pop().toLowerCase()
            : null;
        apps.push({
            canonicalName: name,
            aliases: buildAliases(name),
            executablePath: exePath || null,
            processName,
            source: 'start_menu',
            installLocation: exePath ? exePath.slice(0, exePath.lastIndexOf('\\')) || null : null,
        });
    }
    // Log any diagnostic lines from PS
    for (const raw of stdout.split('\n')) {
        const line = raw.trim();
        if (line.startsWith('SM_') || line.startsWith('SHELL_ERR')) {
            dlog(`[JARVIS_DISCOVERY] PS diag: ${line}`);
        }
    }
    dlog(`[JARVIS_DISCOVERY] startMenu=${apps.length}`);
    return apps;
}
// ─── Source 2: Windows Registry ───────────────────────────────────────────────
const REGISTRY_SCRIPT = `
$keys = @(
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$seen = @{}
$total = 0
foreach ($key in $keys) {
  $items = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
  $cnt = if ($items) { @($items).Count } else { 0 }
  Write-Output "REG_KEY=$key|$cnt"
  foreach ($item in $items) {
    $name = $item.DisplayName
    if (-not $name -or $name.Trim() -eq '' -or $name.Length -lt 2) { continue }
    $nk = $name.Trim().ToLower()
    if ($seen[$nk]) { continue }
    $seen[$nk] = 1
    $total++
    $icon = $item.DisplayIcon
    $exe  = ''
    if ($icon) {
      $clean = ($icon -split ',')[0].Trim('"').Trim()
      if ($clean -match '\.exe$') { $exe = $clean }
    }
    $loc = if ($item.InstallLocation) { $item.InstallLocation.Trim() } else { '' }
    Write-Output "APP=$($name.Trim())|$exe|$loc"
  }
}
Write-Output "REG_TOTAL=$total"
`;
async function scanRegistry() {
    const { stdout, error } = await runPS('registry', REGISTRY_SCRIPT, 20_000);
    if (error && !stdout) {
        dwarn(`[JARVIS_DISCOVERY] registry FAILED: ${error}`);
        return [];
    }
    const apps = [];
    for (const raw of stdout.split('\n')) {
        const line = raw.trim();
        if (line.startsWith('REG_')) {
            dlog(`[JARVIS_DISCOVERY] PS diag: ${line}`);
            continue;
        }
        if (!line.startsWith('APP='))
            continue;
        const rest = line.slice(4);
        const parts = rest.split('|');
        const name = parts[0]?.trim();
        if (!name || name.length < 2)
            continue;
        const exePath = parts[1]?.trim() ?? '';
        const installLoc = parts[2]?.trim() || null;
        const processName = exePath.toLowerCase().endsWith('.exe')
            ? exePath.split('\\').pop().toLowerCase()
            : null;
        apps.push({
            canonicalName: name,
            aliases: buildAliases(name),
            executablePath: exePath || null,
            processName,
            source: 'registry',
            installLocation: installLoc,
        });
    }
    dlog(`[JARVIS_DISCOVERY] registry=${apps.length}`);
    return apps;
}
// ─── Source 3: UWP / Store apps ───────────────────────────────────────────────
const UWP_SCRIPT = `
$pkgs = Get-AppxPackage -ErrorAction SilentlyContinue
foreach ($pkg in $pkgs) {
  $n = $pkg.Name
  if ($n -match '^(Microsoft\\.Net|Microsoft\\.Windows|Microsoft\\.UI|Windows\\.|Microsoft\\.VCLibs|Microsoft\\.DirectX)') { continue }
  $display = $n -replace '^[^.]+\\.', '' -replace '([a-z])([A-Z])', '$1 $2'
  if ($display.Length -lt 2) { continue }
  Write-Output "$display|$($pkg.PackageFamilyName)"
}
`;
async function scanUwpApps() {
    const { stdout, error } = await runPS('uwp', UWP_SCRIPT, 20_000);
    if (error && !stdout) {
        dwarn(`[JARVIS_DISCOVERY] uwp FAILED: ${error}`);
        return [];
    }
    const apps = [];
    for (const line of stdout.split('\n')) {
        const pipe = line.indexOf('|');
        if (pipe === -1)
            continue;
        const display = line.slice(0, pipe).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
        const familyName = line.slice(pipe + 1).trim();
        if (!display || display.length < 2 || !familyName)
            continue;
        apps.push({
            canonicalName: display,
            aliases: buildAliases(display),
            executablePath: null,
            processName: null,
            source: 'uwp',
            installLocation: null,
            uwpFamilyName: familyName,
        });
    }
    dlog(`[JARVIS_DISCOVERY] uwp=${apps.length}`);
    return apps;
}
// ─── Source 4: Running processes ─────────────────────────────────────────────
//
// Primary: Get-Process (includes window title)
// Fallback: tasklist /v (always available, simpler)
const RUNNING_PS_SCRIPT = `
Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -ne '' } |
  ForEach-Object {
    $name = if ($_.MainWindowTitle) { ($_.MainWindowTitle -split ' - ')[0].Trim() } else { $_.ProcessName }
    Write-Output "$($_.ProcessName)|$($_.Path)|$name"
  }
`;
async function scanRunningProcesses() {
    const { stdout, error } = await runPS('running', RUNNING_PS_SCRIPT, 12_000);
    const apps = [];
    const seen = new Set();
    if (!error && stdout) {
        for (const line of stdout.split('\n')) {
            const parts = line.trim().split('|');
            const procName = parts[0]?.trim();
            const exePath = parts[1]?.trim();
            const title = parts[2]?.trim();
            if (!procName)
                continue;
            const key = procName.toLowerCase();
            if (seen.has(key))
                continue;
            seen.add(key);
            const displayName = title || procName.replace(/\.exe$/i, '');
            apps.push({
                canonicalName: displayName,
                aliases: buildAliases(displayName),
                executablePath: exePath || null,
                processName: key.endsWith('.exe') ? key : `${key}.exe`,
                source: 'running',
                installLocation: exePath ? exePath.slice(0, exePath.lastIndexOf('\\')) || null : null,
            });
        }
    }
    // Fallback: tasklist if Get-Process returned nothing
    if (apps.length === 0) {
        try {
            const { stdout: tl } = await execAsync('tasklist /v /fo csv /nh', { windowsHide: true, timeout: 8_000 });
            for (const line of tl.split('\n')) {
                const cols = line.trim().replace(/^"|"$/g, '').split('","');
                const procName = cols[0]?.trim();
                const title = cols[9]?.trim();
                if (!procName || procName === 'System Idle Process')
                    continue;
                const key = procName.toLowerCase();
                if (seen.has(key))
                    continue;
                seen.add(key);
                if (title === 'N/A' || !title)
                    continue; // background-only
                apps.push({
                    canonicalName: title.replace(/ - .*$/, '').trim() || procName.replace(/\.exe$/i, ''),
                    aliases: buildAliases(procName.replace(/\.exe$/i, '')),
                    executablePath: null,
                    processName: key,
                    source: 'running',
                    installLocation: null,
                });
            }
        }
        catch {
            // tasklist also failed — running source returns empty
        }
    }
    dlog(`[JARVIS_DISCOVERY] running=${apps.length}`);
    return apps;
}
// ─── Registry merge + dedup ───────────────────────────────────────────────────
function mergeRegistry(startMenu, registry, uwp, running) {
    const merged = new Map();
    const priority = ['start_menu', 'registry', 'uwp', 'running'];
    const lists = {
        start_menu: startMenu,
        registry,
        uwp,
        running,
    };
    for (const source of priority) {
        for (const app of lists[source]) {
            const key = norm(app.canonicalName);
            if (!merged.has(key)) {
                merged.set(key, app);
            }
            else {
                const existing = merged.get(key);
                if (!existing.executablePath && app.executablePath) {
                    merged.set(key, { ...existing, executablePath: app.executablePath, processName: app.processName });
                }
            }
        }
    }
    return [...merged.values()];
}
// ─── Startup diagnostic ───────────────────────────────────────────────────────
// Runs BEFORE the real scan to detect PS environment problems early.
async function diagnosePSEnvironment() {
    safeLogger.info('[JARVIS_DIAG] ========== PowerShell environment check ==========');
    // 1. Is powershell.exe locatable?
    try {
        const { stdout: wherePs } = await execAsync('where powershell', { timeout: 5_000, windowsHide: true });
        safeLogger.info(`[JARVIS_DIAG] where powershell → ${wherePs.trim()}`);
    }
    catch (e) {
        safeLogger.error(`[JARVIS_DIAG] where powershell FAILED: ${e.message}`);
    }
    // 2. Minimal HELLO test
    const helloResult = await runPS('diag:hello', 'Write-Output "HELLO_JARVIS"', 8_000);
    if (helloResult.stdout.includes('HELLO_JARVIS')) {
        safeLogger.info('[JARVIS_DIAG] ✓ Basic PS execution works');
    }
    else {
        safeLogger.error(`[JARVIS_DIAG] ✗ Basic PS FAILED — stdout="${helloResult.stdout}" error="${helloResult.error}"`);
    }
    // 3. Execution policy
    const policyResult = await runPS('diag:policy', 'Get-ExecutionPolicy -List | Out-String | Write-Output', 8_000);
    safeLogger.info(`[JARVIS_DIAG] ExecutionPolicy:\n${policyResult.stdout}`);
    // 4. Get-Process works?
    const gpResult = await runPS('diag:getprocess', '$p = Get-Process -ErrorAction SilentlyContinue\nWrite-Output "PROC_COUNT=$($p.Count)"', 8_000);
    safeLogger.info(`[JARVIS_DIAG] Get-Process → ${gpResult.stdout}`);
    // 5. Start menu paths exist?
    const smDiag = await runPS('diag:startmenu', `
$dirs = @(
  [Environment]::GetFolderPath('CommonStartMenu'),
  [Environment]::GetFolderPath('StartMenu')
)
foreach ($d in $dirs) {
  if (Test-Path $d) {
    $lnks = (Get-ChildItem -Path $d -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue).Count
    Write-Output "EXISTS=$d ($lnks .lnk files)"
  } else {
    Write-Output "MISSING=$d"
  }
}
`, 8_000);
    safeLogger.info(`[JARVIS_DIAG] StartMenu paths:\n${smDiag.stdout}`);
    // 6. Registry access?
    const regDiag = await runPS('diag:registry', '$r = Get-ItemProperty "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" -ErrorAction SilentlyContinue; Write-Output "REG_COUNT=$(@($r).Count)"', 8_000);
    safeLogger.info(`[JARVIS_DIAG] Registry → ${regDiag.stdout}`);
    // 7. tmpdir writable?
    try {
        const tmp = join(tmpdir(), `jarvis_writetest_${Date.now()}.tmp`);
        await writeFile(tmp, 'test', 'utf-8');
        await unlink(tmp);
        safeLogger.info(`[JARVIS_DIAG] ✓ tmpdir writable: ${tmpdir()}`);
    }
    catch (e) {
        safeLogger.error(`[JARVIS_DIAG] ✗ tmpdir NOT writable: ${e.message}`);
    }
    safeLogger.info('[JARVIS_DIAG] ========== End diagnostic ==========');
}
// ─── Main scan ────────────────────────────────────────────────────────────────
async function runFullScan() {
    try {
        const t0 = Date.now();
        safeLogger.info('[JARVIS_DISCOVERY] scan started');
        if (!_diagRan && process.env.JARVIS_DISCOVERY_DIAG === '1') {
            _diagRan = true;
            await diagnosePSEnvironment();
        }
        // Run all four sources in parallel, independently
        const [smResult, regResult, uwpResult, runResult] = await Promise.allSettled([
            scanStartMenu(),
            scanRegistry(),
            scanUwpApps(),
            scanRunningProcesses(),
        ]);
        const startMenu = smResult.status === 'fulfilled' ? smResult.value : [];
        const registry = regResult.status === 'fulfilled' ? regResult.value : [];
        const uwp = uwpResult.status === 'fulfilled' ? uwpResult.value : [];
        const running = runResult.status === 'fulfilled' ? runResult.value : [];
        if (smResult.status === 'rejected')
            dwarn('[JARVIS_DISCOVERY] startMenu threw:', smResult.reason);
        if (regResult.status === 'rejected')
            dwarn('[JARVIS_DISCOVERY] registry threw:', regResult.reason);
        if (uwpResult.status === 'rejected')
            dwarn('[JARVIS_DISCOVERY] uwp threw:', uwpResult.reason);
        if (runResult.status === 'rejected')
            dwarn('[JARVIS_DISCOVERY] running threw:', runResult.reason);
        _registry = mergeRegistry(startMenu, registry, uwp, running);
        _indexed = true;
        safeLogger.info(`[JARVIS_DISCOVERY] scan completed — indexed ${_registry.length} apps ` +
            `(startMenu=${startMenu.length} registry=${registry.length} ` +
            `uwp=${uwp.length} running=${running.length}) ${Date.now() - t0}ms`);
        if (_registry.length === 0) {
            dwarn('[JARVIS_DISCOVERY] all sources returned 0 apps');
        }
    }
    catch (e) {
        derror('[JARVIS_DISCOVERY] runFullScan error:', e instanceof Error ? e.message : String(e));
    }
}
// ─── Public API ───────────────────────────────────────────────────────────────
export function initDiscovery() {
    if (_scanPromise)
        return;
    // Defer first scan so UI + chat work immediately; avoids startup log/crash noise
    _scanPromise = new Promise((resolve) => {
        setTimeout(() => {
            runFullScan().then(resolve).catch((e) => {
                derror('[JARVIS_DISCOVERY] scan failed:', e instanceof Error ? e.message : String(e));
                resolve();
            });
        }, 4_000);
    });
    if (!_refreshTimer) {
        _refreshTimer = setInterval(() => {
            runFullScan().catch((e) => {
                derror('[JARVIS_DISCOVERY] refresh failed:', e instanceof Error ? e.message : String(e));
            });
        }, REFRESH_INTERVAL_MS);
    }
}
export function stopDiscovery() {
    if (_refreshTimer) {
        clearInterval(_refreshTimer);
        _refreshTimer = null;
    }
}
export async function refreshRunningApps() {
    if (!_indexed)
        return;
    const fresh = await scanRunningProcesses();
    for (const app of fresh) {
        const key = norm(app.canonicalName);
        if (!_registry.some((a) => norm(a.canonicalName) === key)) {
            _registry.push(app);
        }
    }
}
export async function fuzzyResolve(query, minScore = 55) {
    if (!_indexed && _scanPromise)
        await _scanPromise;
    if (_registry.length === 0)
        return null;
    const qRaw = query.trim().toLowerCase();
    if (/^what\s*s?\s*app$|^whatsapp$|^wa$/.test(qRaw.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim())) {
        const wa = _registry.find((a) => norm(a.canonicalName).includes('whatsapp'));
        if (wa)
            return { app: wa, score: 100, matchReason: 'whatsapp_typo' };
    }
    const q = norm(query);
    let best = null;
    for (const app of _registry) {
        const { score, reason } = scoreMatch(q, app);
        if (score >= minScore && (!best || score > best.score)) {
            best = { app, score, matchReason: reason };
        }
    }
    if (best) {
        dlog(`[JARVIS_MATCH] resolved="${best.app.canonicalName}" ` +
            `score=${best.score} reason=${best.matchReason}`);
    }
    return best;
}
export function fuzzyResolveSync(query, minScore = 55) {
    if (!_indexed || _registry.length === 0)
        return null;
    const qRaw = query.trim().toLowerCase();
    if (/^what\s*s?\s*app$|^whatsapp$|^wa$/.test(qRaw.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim())) {
        const wa = _registry.find((a) => norm(a.canonicalName).includes('whatsapp'));
        if (wa)
            return { app: wa, score: 100, matchReason: 'whatsapp_typo' };
    }
    const q = norm(query);
    let best = null;
    for (const app of _registry) {
        const { score, reason } = scoreMatch(q, app);
        if (score >= minScore && (!best || score > best.score)) {
            best = { app, score, matchReason: reason };
        }
    }
    return best;
}
export function getDiscoveryRegistry() { return _registry; }
export function isDiscoveryReady() { return _indexed; }
export function getDiscoveryCount() { return _registry.length; }
/** Dump top N entries for the debug panel. */
export function dumpDiscoveredApps(limit = 50) {
    return _registry.slice(0, limit).map((a) => ({
        name: a.canonicalName,
        source: a.source,
        exe: a.executablePath,
        processName: a.processName,
    }));
}
// ─── Scoring ──────────────────────────────────────────────────────────────────
function editDistance(a, b) {
    if (a === b)
        return 0;
    if (Math.abs(a.length - b.length) > 8)
        return 99;
    const la = a.length, lb = b.length;
    const prev = Array.from({ length: lb + 1 }, (_, i) => i);
    const curr = new Array(lb + 1);
    for (let i = 1; i <= la; i++) {
        curr[0] = i;
        for (let j = 1; j <= lb; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        }
        for (let k = 0; k <= lb; k++)
            prev[k] = curr[k];
    }
    return prev[lb];
}
function scoreMatch(query, candidate) {
    const q = norm(query);
    if (!q)
        return { score: 0, reason: 'empty' };
    const targets = [norm(candidate.canonicalName), ...candidate.aliases];
    for (const t of targets) {
        if (q === t)
            return { score: 100, reason: `exact:${t}` };
        if (t.startsWith(q) && q.length >= 3)
            return { score: 88, reason: `prefix:${t}` };
        if (q.startsWith(t) && t.length >= 3)
            return { score: 85, reason: `prefix_rev:${t}` };
        // Substring match only for single-token queries (avoids "what app" ⊂ long Windows strings)
        if (t.includes(q) && q.length >= 4 && !q.includes(' '))
            return { score: 75, reason: `contains:${t}` };
        if (q.includes(t) && t.length >= 4 && !q.includes(' '))
            return { score: 72, reason: `contained_in:${t}` };
    }
    const STOP_QUERY = new Set(['what', 'app', 'the', 'is', 'new', 'in', 'latest', 'version', 'a', 'an', 'my', 'for']);
    const qWords = q.split(' ').filter((w) => w.length >= 2 && !STOP_QUERY.has(w));
    const nameWords = norm(candidate.canonicalName).split(' ');
    // Require meaningful tokens (prevents "what app" → "What is new in the latest version")
    if (qWords.length === 0)
        return { score: 0, reason: 'stopwords_only' };
    const matched = qWords.filter((qw) => qw.length >= 4 && nameWords.some((nw) => nw.startsWith(qw) || (qw.startsWith(nw) && nw.length >= 4)));
    if (matched.length === qWords.length && qWords.length > 0 && q.length >= 4) {
        return { score: 70, reason: 'all_words' };
    }
    if (matched.length > 0) {
        const ratio = matched.length / Math.max(qWords.length, nameWords.length);
        return { score: Math.round(40 + ratio * 25), reason: `partial_words:${matched.join(',')}` };
    }
    if (!q.includes(' ') && q.length >= 4) {
        for (const t of targets) {
            if (t.includes(' '))
                continue;
            const dist = editDistance(q, t);
            const maxLen = Math.max(q.length, t.length);
            if (dist <= 2)
                return { score: Math.round((1 - dist / maxLen) * 60), reason: `edit:${t}(${dist})` };
        }
    }
    return { score: 0, reason: 'no_match' };
}
