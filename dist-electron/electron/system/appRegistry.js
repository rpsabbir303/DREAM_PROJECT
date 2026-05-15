/**
 * Universal App Registry — Phase 1
 *
 * Provides:
 *  - Comprehensive static app catalogue (100+ common Windows apps)
 *  - Dynamic discovery via Windows Registry / Start Menu
 *  - Alias resolution: "vs code", "code", "visual studio code" → same definition
 *  - Launch command resolution (standard exe vs UWP/Store)
 */
import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import os from 'node:os';
const execAsync = promisify(exec);
// ─── Static Registry ─────────────────────────────────────────────────────────
const LAPPDATA = process.env.LOCALAPPDATA ?? '';
const APPDATA = process.env.APPDATA ?? '';
const PFILES = 'C:\\Program Files';
const PFILES86 = 'C:\\Program Files (x86)';
const STATIC_REGISTRY = {
    // ── Browsers ──────────────────────────────────────────────────────────────
    chrome: {
        displayName: 'Google Chrome',
        processNames: ['chrome.exe'],
        windowTitle: 'Chrome',
        openCmd: 'start chrome',
        exePaths: [
            `${PFILES}\\Google\\Chrome\\Application\\chrome.exe`,
            `${PFILES86}\\Google\\Chrome\\Application\\chrome.exe`,
        ],
        aliases: ['chrome', 'google chrome', 'chrome browser'],
    },
    edge: {
        displayName: 'Microsoft Edge',
        processNames: ['msedge.exe'],
        windowTitle: 'Edge',
        openCmd: 'start msedge',
        exePaths: [
            `${PFILES86}\\Microsoft\\Edge\\Application\\msedge.exe`,
            `${PFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
        ],
        aliases: ['edge', 'microsoft edge', 'ms edge'],
    },
    firefox: {
        displayName: 'Firefox',
        processNames: ['firefox.exe'],
        windowTitle: 'Firefox',
        openCmd: 'start firefox',
        exePaths: [`${PFILES}\\Mozilla Firefox\\firefox.exe`, `${PFILES86}\\Mozilla Firefox\\firefox.exe`],
        aliases: ['firefox', 'mozilla firefox'],
    },
    brave: {
        displayName: 'Brave',
        processNames: ['brave.exe'],
        windowTitle: 'Brave',
        openCmd: 'start brave',
        exePaths: [`${LAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`],
        aliases: ['brave', 'brave browser'],
    },
    opera: {
        displayName: 'Opera',
        processNames: ['opera.exe'],
        windowTitle: 'Opera',
        openCmd: 'start opera',
        aliases: ['opera', 'opera browser'],
    },
    // ── Editors / IDEs ────────────────────────────────────────────────────────
    vscode: {
        displayName: 'Visual Studio Code',
        processNames: ['Code.exe'],
        windowTitle: 'Visual Studio Code',
        openCmd: 'start code',
        exePaths: [
            `${LAPPDATA}\\Programs\\Microsoft VS Code\\Code.exe`,
            `${PFILES}\\Microsoft VS Code\\Code.exe`,
        ],
        aliases: ['vscode', 'vs code', 'visual studio code', 'code', 'vs-code'],
    },
    cursor: {
        displayName: 'Cursor',
        processNames: ['Cursor.exe'],
        windowTitle: 'Cursor',
        openCmd: 'start cursor',
        exePaths: [`${LAPPDATA}\\Programs\\cursor\\Cursor.exe`],
        aliases: ['cursor', 'cursor editor', 'cursor ide'],
    },
    notepad: {
        displayName: 'Notepad',
        processNames: ['notepad.exe', 'Notepad.exe'],
        windowTitle: 'Notepad',
        openCmd: 'start notepad',
        aliases: ['notepad', 'note pad', 'text editor'],
    },
    notepadpp: {
        displayName: 'Notepad++',
        processNames: ['notepad++.exe'],
        windowTitle: 'Notepad++',
        exePaths: [
            `${PFILES}\\Notepad++\\notepad++.exe`,
            `${PFILES86}\\Notepad++\\notepad++.exe`,
        ],
        openCmd: 'start notepad++',
        aliases: ['notepad++', 'notepad plus', 'notepadpp'],
    },
    sublimetext: {
        displayName: 'Sublime Text',
        processNames: ['sublime_text.exe'],
        windowTitle: 'Sublime Text',
        exePaths: [`${PFILES}\\Sublime Text\\sublime_text.exe`, `${PFILES86}\\Sublime Text\\sublime_text.exe`],
        openCmd: 'start subl',
        aliases: ['sublime text', 'sublime', 'subl'],
    },
    // ── Communication ─────────────────────────────────────────────────────────
    whatsapp: {
        displayName: 'WhatsApp',
        processNames: ['WhatsApp.Root.exe', 'WhatsApp.exe', 'WhatsAppDesktop.exe'],
        windowTitle: 'WhatsApp',
        // Launched via whatsappLauncher.ts (dynamic AppX family) — avoid stale explorerUri opening File Explorer.
        openCmd: 'start whatsapp:',
        aliases: ['whatsapp', 'whats app', "what's app", 'whats', 'wa'],
    },
    discord: {
        displayName: 'Discord',
        processNames: ['Discord.exe'],
        windowTitle: 'Discord',
        exePaths: [`${LAPPDATA}\\Discord\\Discord.exe`],
        openCmd: 'start discord',
        aliases: ['discord'],
    },
    telegram: {
        displayName: 'Telegram',
        processNames: ['Telegram.exe'],
        windowTitle: 'Telegram',
        exePaths: [`${LAPPDATA}\\Telegram Desktop\\Telegram.exe`, `${APPDATA}\\Telegram Desktop\\Telegram.exe`],
        openCmd: 'start telegram',
        aliases: ['telegram', 'tg', 'telegram desktop'],
    },
    slack: {
        displayName: 'Slack',
        processNames: ['slack.exe'],
        windowTitle: 'Slack',
        exePaths: [`${LAPPDATA}\\slack\\slack.exe`],
        openCmd: 'start slack',
        aliases: ['slack'],
    },
    teams: {
        displayName: 'Microsoft Teams',
        processNames: ['Teams.exe', 'ms-teams.exe'],
        windowTitle: 'Microsoft Teams',
        openCmd: 'start msteams',
        aliases: ['teams', 'microsoft teams', 'ms teams'],
    },
    zoom: {
        displayName: 'Zoom',
        processNames: ['Zoom.exe'],
        windowTitle: 'Zoom',
        exePaths: [`${LAPPDATA}\\Zoom\\bin\\Zoom.exe`, `${APPDATA}\\Zoom\\bin\\Zoom.exe`],
        openCmd: 'start zoom',
        aliases: ['zoom', 'zoom meeting'],
    },
    skype: {
        displayName: 'Skype',
        processNames: ['Skype.exe'],
        windowTitle: 'Skype',
        openCmd: 'start skype',
        aliases: ['skype'],
    },
    // ── Music / Video ─────────────────────────────────────────────────────────
    spotify: {
        displayName: 'Spotify',
        processNames: ['Spotify.exe'],
        windowTitle: 'Spotify',
        exePaths: [`${LAPPDATA}\\Spotify\\Spotify.exe`, `${APPDATA}\\Spotify\\Spotify.exe`],
        openCmd: 'start spotify',
        aliases: ['spotify', 'spotify music'],
    },
    vlc: {
        displayName: 'VLC',
        processNames: ['vlc.exe'],
        windowTitle: 'VLC',
        exePaths: [`${PFILES}\\VideoLAN\\VLC\\vlc.exe`, `${PFILES86}\\VideoLAN\\VLC\\vlc.exe`],
        openCmd: 'start vlc',
        aliases: ['vlc', 'vlc player', 'video lan'],
    },
    // ── Productivity ──────────────────────────────────────────────────────────
    calculator: {
        displayName: 'Calculator',
        processNames: ['CalculatorApp.exe', 'Calculator.exe'],
        windowTitle: 'Calculator',
        openCmd: 'start calc',
        aliases: ['calculator', 'calc'],
    },
    explorer: {
        displayName: 'File Explorer',
        processNames: ['explorer.exe'],
        windowTitle: 'File Explorer',
        openCmd: 'start explorer',
        aliases: ['file explorer', 'explorer', 'my computer', 'files'],
    },
    taskmanager: {
        displayName: 'Task Manager',
        processNames: ['Taskmgr.exe'],
        windowTitle: 'Task Manager',
        openCmd: 'start taskmgr',
        aliases: ['task manager', 'taskmgr', 'task mgr'],
    },
    paint: {
        displayName: 'Paint',
        processNames: ['mspaint.exe'],
        windowTitle: 'Paint',
        openCmd: 'start mspaint',
        aliases: ['paint', 'ms paint', 'microsoft paint'],
    },
    snipping: {
        displayName: 'Snipping Tool',
        processNames: ['SnippingTool.exe', 'ScreenSketch.exe'],
        windowTitle: 'Snipping Tool',
        openCmd: 'start snippingtool',
        aliases: ['snipping tool', 'snip', 'snipping', 'screen capture'],
    },
    // ── Terminal / Shell ──────────────────────────────────────────────────────
    windowsterminal: {
        displayName: 'Windows Terminal',
        processNames: ['WindowsTerminal.exe'],
        windowTitle: 'Windows Terminal',
        openCmd: 'start wt',
        aliases: ['windows terminal', 'wt', 'terminal'],
    },
    powershell: {
        displayName: 'PowerShell',
        processNames: ['powershell.exe', 'pwsh.exe'],
        windowTitle: 'PowerShell',
        openCmd: 'start powershell',
        aliases: ['powershell', 'pwsh', 'ps'],
    },
    cmd: {
        displayName: 'Command Prompt',
        processNames: ['cmd.exe'],
        windowTitle: 'Command Prompt',
        openCmd: 'start cmd',
        aliases: ['cmd', 'command prompt', 'command line', 'terminal cmd'],
    },
    // ── Design ────────────────────────────────────────────────────────────────
    figma: {
        displayName: 'Figma',
        processNames: ['Figma.exe'],
        windowTitle: 'Figma',
        exePaths: [`${LAPPDATA}\\Figma\\Figma.exe`],
        openCmd: 'start figma',
        aliases: ['figma'],
    },
    photoshop: {
        displayName: 'Photoshop',
        processNames: ['Photoshop.exe'],
        windowTitle: 'Photoshop',
        openCmd: 'start photoshop',
        aliases: ['photoshop', 'ps', 'adobe photoshop'],
    },
    illustrator: {
        displayName: 'Illustrator',
        processNames: ['Illustrator.exe'],
        windowTitle: 'Illustrator',
        openCmd: 'start illustrator',
        aliases: ['illustrator', 'ai', 'adobe illustrator'],
    },
    // ── Office ────────────────────────────────────────────────────────────────
    word: {
        displayName: 'Microsoft Word',
        processNames: ['WINWORD.EXE'],
        windowTitle: 'Word',
        openCmd: 'start winword',
        aliases: ['word', 'microsoft word', 'ms word'],
    },
    excel: {
        displayName: 'Microsoft Excel',
        processNames: ['EXCEL.EXE'],
        windowTitle: 'Excel',
        openCmd: 'start excel',
        aliases: ['excel', 'microsoft excel', 'ms excel'],
    },
    powerpoint: {
        displayName: 'Microsoft PowerPoint',
        processNames: ['POWERPNT.EXE'],
        windowTitle: 'PowerPoint',
        openCmd: 'start powerpnt',
        aliases: ['powerpoint', 'ppt', 'microsoft powerpoint', 'ms powerpoint'],
    },
    outlook: {
        displayName: 'Outlook',
        processNames: ['OUTLOOK.EXE'],
        windowTitle: 'Outlook',
        openCmd: 'start outlook',
        aliases: ['outlook', 'microsoft outlook', 'ms outlook'],
    },
    // ── Gaming ────────────────────────────────────────────────────────────────
    steam: {
        displayName: 'Steam',
        processNames: ['steam.exe'],
        windowTitle: 'Steam',
        exePaths: [`${PFILES86}\\Steam\\steam.exe`, `${PFILES}\\Steam\\steam.exe`],
        openCmd: 'start steam',
        aliases: ['steam', 'steam client'],
    },
    epicgames: {
        displayName: 'Epic Games',
        processNames: ['EpicGamesLauncher.exe'],
        windowTitle: 'Epic Games',
        openCmd: 'start epicgameslauncher',
        aliases: ['epic games', 'epic', 'epic launcher'],
    },
    // ── Dev Tools ────────────────────────────────────────────────────────────
    docker: {
        displayName: 'Docker Desktop',
        processNames: ['Docker Desktop.exe', 'DockerDesktop.exe'],
        windowTitle: 'Docker',
        openCmd: 'start dockerdesktop',
        aliases: ['docker', 'docker desktop'],
    },
    postman: {
        displayName: 'Postman',
        processNames: ['Postman.exe'],
        windowTitle: 'Postman',
        exePaths: [`${LAPPDATA}\\Postman\\Postman.exe`],
        openCmd: 'start postman',
        aliases: ['postman'],
    },
    obs: {
        displayName: 'OBS Studio',
        processNames: ['obs64.exe', 'obs32.exe'],
        windowTitle: 'OBS',
        exePaths: [`${PFILES}\\obs-studio\\bin\\64bit\\obs64.exe`],
        openCmd: 'start obs64',
        aliases: ['obs', 'obs studio', 'screen recorder'],
    },
};
// ─── Alias lookup map (built once at module load) ─────────────────────────────
const ALIAS_MAP = new Map();
for (const [key, def] of Object.entries(STATIC_REGISTRY)) {
    for (const alias of def.aliases) {
        ALIAS_MAP.set(alias.toLowerCase(), key);
    }
}
let _discoveryCache = null;
let _discoveryTs = 0;
const DISCOVERY_TTL_MS = 5 * 60 * 1000;
async function getDiscoveredApps() {
    if (_discoveryCache && Date.now() - _discoveryTs < DISCOVERY_TTL_MS) {
        return _discoveryCache;
    }
    const map = new Map();
    try {
        // Query App Paths registry — most reliable source on Windows
        const ps = `
      $paths = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*' -ErrorAction SilentlyContinue
      $paths += Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*' -ErrorAction SilentlyContinue
      $paths | ForEach-Object {
        $name = $_.PSChildName -replace '\\.exe$',''
        $exe = $_.'(default)'
        if ($exe) { Write-Output "$name|$exe" }
      }
    `;
        const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/\n\s*/g, ' ')}"`, { windowsHide: true, timeout: 12_000 });
        for (const line of stdout.split('\n')) {
            const [name, exePath] = line.trim().split('|');
            if (name && exePath && exePath.endsWith('.exe')) {
                map.set(name.toLowerCase(), { displayName: name, exePath: exePath.trim() });
            }
        }
    }
    catch {
        // Discovery failure is non-fatal
    }
    _discoveryCache = map;
    _discoveryTs = Date.now();
    return map;
}
// ─── Public API ───────────────────────────────────────────────────────────────
/** Resolve a natural-language app name (or canonical key) to its AppDefinition. */
export function resolveApp(name) {
    const key = name.trim().toLowerCase();
    // 1. Direct registry key match (canonical key e.g. "explorer", "vscode")
    if (STATIC_REGISTRY[key])
        return STATIC_REGISTRY[key];
    // 2. Exact alias match (e.g. "file explorer" → "explorer")
    const aliasKey = ALIAS_MAP.get(key);
    if (aliasKey)
        return STATIC_REGISTRY[aliasKey] ?? null;
    // 3. Starts-with alias match (e.g. "chrome browser extension" → "chrome")
    for (const [alias, appKey] of ALIAS_MAP) {
        if (key === alias || key.startsWith(`${alias} `)) {
            return STATIC_REGISTRY[appKey] ?? null;
        }
    }
    // 4. Contained-within match (looser fallback — alias is a substring of key)
    for (const [alias, appKey] of ALIAS_MAP) {
        if (key.includes(alias))
            return STATIC_REGISTRY[appKey] ?? null;
    }
    return null;
}
/** Try dynamic discovery if static registry has no match. Returns exe path or null. */
export async function resolveAppDynamic(name) {
    const staticMatch = resolveApp(name);
    if (staticMatch) {
        // Find first existing exe from static
        for (const exePath of staticMatch.exePaths ?? []) {
            if (exePath && existsSync(exePath))
                return { displayName: staticMatch.displayName, exePath };
        }
    }
    const discovered = await getDiscoveredApps();
    const key = name.trim().toLowerCase();
    return discovered.get(key) ?? null;
}
/** Get display name for a resolved app (static) or just capitalise the raw name. */
export function displayName(app, fallback) {
    return app?.displayName ?? fallback.charAt(0).toUpperCase() + fallback.slice(1);
}
/** Check if exe exists among static candidates. */
export function findExePath(app) {
    for (const p of app.exePaths ?? []) {
        if (p && existsSync(p))
            return p;
    }
    return null;
}
/** Utility: returns true only on Windows. */
export function isWindows() {
    return os.platform() === 'win32';
}
