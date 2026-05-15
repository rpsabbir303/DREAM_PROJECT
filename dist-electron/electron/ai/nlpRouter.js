/**
 * NLP Router — Phase 6 (v2)
 *
 * Converts natural language into a typed ResolvedIntent via deterministic
 * pattern matching. No LLM required for supported commands.
 *
 * Returns null → Gemini handles general chat / complex requests.
 *
 * Routing priority:
 *   1. System commands  (mute, screenshot, lock, shutdown …)
 *   2. Folder opens     (downloads, desktop, documents …)
 *   3. Browser          (URLs, searches, site shortcuts)
 *   4. App control      (open/close/focus/minimize/maximize/restart)
 *   5. File ops         (create/delete/move/rename/search)
 *   6. Window info      (list, active)
 *   7. Agent planning   (multi-step goal)
 */
import { stripCommandPreamble } from './commandContext.js';
import { getRiskLevel } from '../security/actionGuard.js';
import { fuzzyResolveSync } from '../system/appDiscovery.js';
// ─── Builder ─────────────────────────────────────────────────────────────────
function make(type, params, rawInput, confidence, displayLabel) {
    return { type, params, rawInput, confidence, riskLevel: getRiskLevel(type), displayLabel };
}
// ─── Normaliser ───────────────────────────────────────────────────────────────
/** Strips soft preambles and normalises whitespace / punctuation. */
function normalise(raw) {
    return stripCommandPreamble(raw)
        .toLowerCase()
        .replace(/[''`]/g, "'")
        .replace(/\s+/g, ' ')
        .replace(/[.!?,;]+$/, '')
        .trim();
}
// ─── Known app alias table ────────────────────────────────────────────────────
//
// This is the CANONICAL list of natural-language app names that the router
// understands. Matching here guarantees we NEVER fall through to Gemini for
// these apps.  Keep sorted by key for readability.
//
// The key is the canonical app key used in appRegistry.ts.
// The values are all valid natural-language names (lowercased, trimmed).
const APP_ALIASES = {
    brave: ['brave', 'brave browser'],
    calculator: ['calculator', 'calc', 'calculation'],
    chrome: ['chrome', 'google chrome', 'chrome browser', 'browser', 'google browser'],
    cmd: ['cmd', 'command prompt', 'command line', 'dos', 'cmd prompt'],
    cursor: ['cursor', 'cursor editor', 'cursor ide', 'cursor app'],
    discord: ['discord'],
    docker: ['docker', 'docker desktop'],
    edge: ['edge', 'microsoft edge', 'ms edge', 'edge browser'],
    epicgames: ['epic games', 'epic', 'epic games launcher', 'epic launcher'],
    excel: ['excel', 'microsoft excel', 'ms excel', 'spreadsheet'],
    explorer: ['file explorer', 'explorer', 'windows explorer', 'files', 'folders',
        'my computer', 'this pc', 'my pc', 'file manager', 'explorer.exe'],
    figma: ['figma'],
    firefox: ['firefox', 'mozilla firefox', 'mozilla'],
    illustrator: ['illustrator', 'adobe illustrator', 'ai illustrator'],
    notepad: ['notepad', 'note pad', 'notes', 'text editor', 'notepad app'],
    notepadpp: ['notepad++', 'notepad plus', 'notepad plus plus', 'npp'],
    obs: ['obs', 'obs studio', 'screen recorder', 'obs recorder'],
    opera: ['opera', 'opera browser', 'opera gx'],
    outlook: ['outlook', 'microsoft outlook', 'ms outlook', 'outlook mail'],
    paint: ['paint', 'ms paint', 'microsoft paint', 'mspaint'],
    photoshop: ['photoshop', 'adobe photoshop', 'ps photoshop'],
    postman: ['postman', 'postman api'],
    powerpoint: ['powerpoint', 'ppt', 'microsoft powerpoint', 'ms powerpoint', 'presentation'],
    powershell: ['powershell', 'pwsh', 'ps shell', 'windows powershell'],
    skype: ['skype', 'microsoft skype'],
    slack: ['slack', 'slack app'],
    snipping: ['snipping tool', 'snip', 'snipping', 'snip tool', 'screen snip'],
    spotify: ['spotify', 'spotify music', 'spotify app'],
    steam: ['steam', 'steam client', 'steam launcher'],
    sublimetext: ['sublime text', 'sublime', 'subl'],
    taskmanager: ['task manager', 'taskmgr', 'task mgr', 'process manager'],
    teams: ['teams', 'microsoft teams', 'ms teams', 'teams app'],
    telegram: ['telegram', 'tg', 'telegram desktop'],
    vlc: ['vlc', 'vlc player', 'vlc media player', 'video player'],
    vscode: ['vscode', 'vs code', 'visual studio code', 'code', 'vs-code', 'code editor'],
    whatsapp: ['whatsapp', 'whats app', "what's app", 'wa', 'whatsapp desktop'],
    windowsterminal: ['windows terminal', 'terminal', 'wt', 'win terminal'],
    word: ['word', 'microsoft word', 'ms word', 'word processor'],
    zoom: ['zoom', 'zoom meeting', 'zoom app'],
};
/** Flat reverse map: alias → appKey (built once at module load) */
const ALIAS_TO_KEY = new Map();
for (const [key, aliases] of Object.entries(APP_ALIASES)) {
    for (const alias of aliases) {
        ALIAS_TO_KEY.set(alias, key);
    }
}
/**
 * Resolve a natural-language app phrase to its canonical key.
 * Tries exact → then prefix → then substring match.
 */
function resolveAppKey(phrase) {
    const p = phrase.trim().toLowerCase();
    if (!p)
        return null;
    // 1. Exact match
    const exact = ALIAS_TO_KEY.get(p);
    if (exact)
        return exact;
    // 2. Phrase starts with a known alias (e.g. "chrome browser extension" → chrome)
    for (const [alias, key] of ALIAS_TO_KEY) {
        if (p === alias || p.startsWith(`${alias} `))
            return key;
    }
    // 3. A known alias is contained within the phrase
    for (const [alias, key] of ALIAS_TO_KEY) {
        if (p.includes(alias))
            return key;
    }
    return null;
}
// ─── Verb groups ──────────────────────────────────────────────────────────────
const V_OPEN = /^(open|launch|start|run|fire up|bring up|pull up|load|open up|get|start up|boot|spin up)\s+/;
const V_CLOSE = /^(close|quit|exit|stop|kill|end|terminate|shut|force close|force quit)\s+/;
const V_FOCUS = /^(focus|switch to|go to|switch|activate|bring|show|navigate to|jump to)\s+(the\s+|my\s+)?/;
const V_MINIMIZE = /^(minimize|minimise|hide|send to taskbar|collapse)\s+(the\s+|my\s+)?/;
const V_MAXIMIZE = /^(maximize|maximise|fullscreen|full screen|expand|restore|make full|enlarge)\s+(the\s+|my\s+)?/;
const V_RESTART = /^(restart|relaunch|reload|reopen|reset)\s+(the\s+|my\s+)?/;
const ARTICLE = /^(the|my|a|an|some)\s+/;
function stripVerb(s, re) {
    const m = s.match(re);
    if (!m)
        return null;
    return s.slice(m[0].length).replace(ARTICLE, '').trim();
}
// ─── Domain: App control ──────────────────────────────────────────────────────
/**
 * Resolve an app phrase using both the static alias table AND the live discovery cache.
 * Returns { appKey?, discoveryName? } — at least one will be set if a match is found.
 */
function resolveAppTarget(phrase) {
    // 1. Static alias table (exact/prefix/substring)
    const staticKey = resolveAppKey(phrase);
    if (staticKey)
        return { appKey: staticKey };
    // 2. Live discovery registry (fuzzy, sync — no await needed, uses cache)
    const discovered = fuzzyResolveSync(phrase, 60);
    if (discovered) {
        console.log(`[JARVIS_NLP] discovery match — "${phrase}" → "${discovered.app.canonicalName}" (score=${discovered.score})`);
        return { discoveryName: discovered.app.canonicalName };
    }
    return null;
}
/**
 * Determine if a phrase looks like an app name and not a sentence fragment.
 * Allows single words and multi-word app names (e.g. "adobe premiere", "vs code").
 */
function looksLikeAppName(phrase) {
    if (!phrase || phrase.length < 2 || phrase.length > 60)
        return false;
    // Reject sentences: contains filler words as a complete clause
    if (/\b(is|are|was|will|can|should|would|the|and|but|or|for|with)\b/.test(phrase) && phrase.split(' ').length > 3) {
        return false;
    }
    return true;
}
function matchApp(s, raw) {
    let target;
    // Open
    if ((target = stripVerb(s, V_OPEN)) !== null) {
        const resolved = resolveAppTarget(target);
        if (resolved) {
            const { appKey, discoveryName } = resolved;
            const params = { app: target };
            if (appKey)
                params.appKey = appKey;
            if (discoveryName)
                params.discoveryName = discoveryName;
            const label = appKey ?? discoveryName ?? target;
            console.log(`[JARVIS_NLP] matched app.open — raw="${target}" key="${appKey ?? '—'}" discovery="${discoveryName ?? '—'}"`);
            return make('app.open', params, raw, 0.95, `Open ${label}`);
        }
        // No static or discovery match — but still route if it looks like an app name
        // The appPlugin will attempt all fallback strategies including `start <name>`
        if (looksLikeAppName(target)) {
            console.log(`[JARVIS_NLP] matched app.open (universal fallback) — raw="${target}"`);
            return make('app.open', { app: target }, raw, 0.82, `Open ${target}`);
        }
        return null;
    }
    // Close
    if ((target = stripVerb(s, V_CLOSE)) !== null) {
        const resolved = resolveAppTarget(target);
        if (resolved) {
            const params = { app: target, ...(resolved.appKey ? { appKey: resolved.appKey } : {}) };
            console.log(`[JARVIS_NLP] matched app.close — raw="${target}" key="${resolved.appKey ?? '—'}"`);
            return make('app.close', params, raw, 0.95, `Close ${target}`);
        }
        if (looksLikeAppName(target)) {
            return make('app.close', { app: target }, raw, 0.82, `Close ${target}`);
        }
        return null;
    }
    // Focus / switch
    if ((target = stripVerb(s, V_FOCUS)) !== null) {
        const resolved = resolveAppTarget(target);
        const params = { app: target, ...(resolved?.appKey ? { appKey: resolved.appKey } : {}) };
        console.log(`[JARVIS_NLP] matched app.focus — raw="${target}"`);
        return make('app.focus', params, raw, 0.9, `Focus ${target}`);
    }
    // Minimize
    if ((target = stripVerb(s, V_MINIMIZE)) !== null) {
        const resolved = resolveAppTarget(target);
        const params = { app: target, ...(resolved?.appKey ? { appKey: resolved.appKey } : {}) };
        return make('app.minimize', params, raw, 0.9, `Minimize ${target}`);
    }
    // Maximize
    if ((target = stripVerb(s, V_MAXIMIZE)) !== null) {
        const resolved = resolveAppTarget(target);
        const params = { app: target, ...(resolved?.appKey ? { appKey: resolved.appKey } : {}) };
        return make('app.maximize', params, raw, 0.9, `Maximize ${target}`);
    }
    // Restart
    if ((target = stripVerb(s, V_RESTART)) !== null) {
        const resolved = resolveAppTarget(target);
        const params = { app: target, ...(resolved?.appKey ? { appKey: resolved.appKey } : {}) };
        return make('app.restart', params, raw, 0.88, `Restart ${target}`);
    }
    // "list running apps" / "what's open"
    if (/^(list|show|what'?s?)\s+(all\s+)?(open|running|active)\s+(apps?|applications?|windows?|programs?)/.test(s)) {
        return make('window.list', {}, raw, 0.92, 'List running apps');
    }
    return null;
}
// ─── Domain: Special folders ──────────────────────────────────────────────────
const SPECIAL_FOLDER_ALIASES = {
    downloads: 'downloads', download: 'downloads',
    desktop: 'desktop',
    documents: 'documents', document: 'documents', docs: 'documents', doc: 'documents',
    music: 'music',
    videos: 'videos', video: 'videos',
    pictures: 'pictures', picture: 'pictures', photos: 'pictures', photo: 'pictures', images: 'pictures', image: 'pictures',
    temp: 'temp', tmp: 'temp', temporary: 'temp',
    home: 'home',
};
function matchFolderOpen(s, raw) {
    // "open downloads" / "open my downloads folder"
    const m = s.match(/^open\s+(?:my\s+)?(?:the\s+)?(.+?)(?:\s+folder)?$/);
    if (!m)
        return null;
    const candidate = m[1].replace(/\s+folder$/, '').trim();
    const key = SPECIAL_FOLDER_ALIASES[candidate];
    if (!key)
        return null;
    console.log(`[JARVIS_NLP] matched folder.open — folder="${key}"`);
    return make('folder.open', { folder: key }, raw, 0.95, `Open ${key}`);
}
// ─── Domain: File operations ──────────────────────────────────────────────────
function matchFile(s, raw) {
    // Create folder
    const mkdirMatch = s.match(/^(?:create|make|new)\s+(?:a\s+)?(?:new\s+)?folder\s+(?:called|named|with name)?\s*"?([^"]+)"?$/);
    if (mkdirMatch) {
        const name = mkdirMatch[1].trim();
        console.log(`[JARVIS_NLP] matched folder.create — name="${name}"`);
        return make('folder.create', { name }, raw, 0.92, `Create folder "${name}"`);
    }
    // Create file
    const mkfileMatch = s.match(/^(?:create|make|new)\s+(?:a\s+)?(?:new\s+)?(?:text\s+|empty\s+)?file\s+(?:called|named|with name)?\s*"?([^"]+)"?$/);
    if (mkfileMatch) {
        const name = mkfileMatch[1].trim();
        console.log(`[JARVIS_NLP] matched file.create — name="${name}"`);
        return make('file.create', { name }, raw, 0.92, `Create file "${name}"`);
    }
    // Search
    const searchMatch = s.match(/^(?:search|find|look for|locate|search for)\s+(?:files?\s+(?:called|named)?\s+)?(?:for\s+)?"?([^"]{2,80})"?$/);
    if (searchMatch) {
        const query = searchMatch[1].trim();
        console.log(`[JARVIS_NLP] matched file.search — query="${query}"`);
        return make('file.search', { query }, raw, 0.88, `Search for "${query}"`);
    }
    // Delete
    const deleteMatch = s.match(/^(?:delete|remove|trash)\s+(?:the\s+)?(?:file\s+|folder\s+)?"?([^"]+)"?$/);
    if (deleteMatch) {
        const target = deleteMatch[1].trim();
        return make('file.delete', { target }, raw, 0.88, `Delete "${target}"`);
    }
    // Rename
    const renameMatch = s.match(/^rename\s+"?([^"]+)"?\s+to\s+"?([^"]+)"?$/);
    if (renameMatch) {
        return make('file.rename', { target: renameMatch[1].trim(), newName: renameMatch[2].trim() }, raw, 0.9, `Rename file`);
    }
    // Move
    const moveMatch = s.match(/^move\s+"?([^"]+)"?\s+to\s+"?([^"]+)"?$/);
    if (moveMatch) {
        return make('file.move', { src: moveMatch[1].trim(), dest: moveMatch[2].trim() }, raw, 0.9, `Move file`);
    }
    return null;
}
// ─── Domain: System control ──────────────────────────────────────────────────
function matchSystem(s, raw) {
    // Volume mute/unmute
    if (/^(mute|unmute|toggle mute|toggle volume)(\s+volume)?$/.test(s)
        || /^(turn off|turn on)\s+(the\s+)?volume$/.test(s)
        || s === 'mute' || s === 'unmute') {
        console.log('[JARVIS_NLP] matched system.volume mute');
        return make('system.volume', { action: 'mute' }, raw, 0.97, 'Toggle mute');
    }
    // Volume set
    const volSet = s.match(/^(?:set\s+)?(?:the\s+)?volume\s+(?:to\s+)?(\d{1,3})\s*%?$/);
    if (volSet)
        return make('system.volume', { action: 'set', level: volSet[1] }, raw, 0.95, `Volume → ${volSet[1]}%`);
    // Volume up
    const volUp = s.match(/^(?:increase|raise|turn up|volume up|louder)\s*(?:the\s+)?(?:volume)?\s*(?:by\s+(\d+)\s*%?)?$/);
    if (volUp)
        return make('system.volume', { action: 'increase', amount: volUp[1] ?? '5' }, raw, 0.93, 'Volume up');
    // Volume down
    const volDown = s.match(/^(?:decrease|lower|turn down|reduce|volume down|quieter|softer)\s*(?:the\s+)?(?:volume)?\s*(?:by\s+(\d+)\s*%?)?$/);
    if (volDown)
        return make('system.volume', { action: 'decrease', amount: volDown[1] ?? '5' }, raw, 0.93, 'Volume down');
    // Brightness
    const bright = s.match(/^(?:set\s+)?(?:the\s+)?brightness\s+(?:to\s+)?(\d{1,3})\s*%?$/);
    if (bright)
        return make('system.brightness', { level: bright[1] }, raw, 0.92, `Brightness → ${bright[1]}%`);
    // Screenshot
    if (/^(take|capture|screenshot|snap|grab screen|screen shot|take a screenshot|capture screen|take screenshot|ss)/.test(s)) {
        console.log('[JARVIS_NLP] matched system.screenshot');
        return make('system.screenshot', {}, raw, 0.97, 'Take screenshot');
    }
    // Lock
    if (/^(lock|lock (the )?(pc|computer|screen|windows|machine|workstation)|lock screen)/.test(s)) {
        console.log('[JARVIS_NLP] matched system.lock');
        return make('system.lock', {}, raw, 0.97, 'Lock screen');
    }
    // Sleep
    if (/^(sleep|hibernate|put (the )?(pc|computer|machine) to sleep|sleep mode)/.test(s)) {
        return make('system.sleep', {}, raw, 0.95, 'Sleep PC');
    }
    // Shutdown
    if (/^(shutdown|shut down|power off|turn off)\s*(the\s+)?(pc|computer|machine|windows)?$/.test(s)) {
        return make('system.shutdown', {}, raw, 0.97, 'Shutdown PC');
    }
    // Restart
    if (/^(restart|reboot)\s*(the\s+)?(pc|computer|machine|windows)?$/.test(s)) {
        return make('system.restart', {}, raw, 0.97, 'Restart PC');
    }
    // WiFi
    const wifi = s.match(/^(?:turn\s+)?(on|off|enable|disable)\s+(?:wi-?fi|wifi|wireless|internet)$/)
        ?? s.match(/^(?:wi-?fi|wifi)\s+(on|off)$/);
    if (wifi) {
        const on = wifi[1] === 'on' || wifi[1] === 'enable';
        return make('system.wifi', { action: on ? 'on' : 'off' }, raw, 0.93, `Wi-Fi ${on ? 'on' : 'off'}`);
    }
    // Bluetooth
    const bt = s.match(/^(?:turn\s+)?(on|off|enable|disable)\s+bluetooth$/)
        ?? s.match(/^bluetooth\s+(on|off)$/);
    if (bt) {
        const on = bt[1] === 'on' || bt[1] === 'enable';
        return make('system.bluetooth', { action: on ? 'on' : 'off' }, raw, 0.93, `Bluetooth ${on ? 'on' : 'off'}`);
    }
    // Recycle bin
    if (/^(?:empty|clear)\s+(?:the\s+)?(?:recycle\s+bin|trash|bin)/.test(s)) {
        return make('system.recycle', {}, raw, 0.97, 'Empty Recycle Bin');
    }
    // Clipboard
    if (/^(?:what'?s?|show|read|get|check)\s+(?:in\s+)?(?:my\s+)?clipboard/.test(s)) {
        return make('system.clipboard', { action: 'read' }, raw, 0.9, 'Read clipboard');
    }
    if (/^clear(?:ing)?\s+(?:my\s+)?clipboard/.test(s)) {
        return make('system.clipboard', { action: 'clear' }, raw, 0.9, 'Clear clipboard');
    }
    return null;
}
// ─── Domain: Browser ─────────────────────────────────────────────────────────
const SITE_NAMES = [
    'youtube', 'google', 'gmail', 'github', 'chatgpt', 'gemini', 'notion',
    'figma', 'vercel', 'netlify', 'aws', 'azure', 'twitter', 'x', 'reddit',
    'linkedin', 'facebook', 'instagram', 'discord', 'slack', 'spotify',
    'netflix', 'amazon', 'stackoverflow', 'mdn', 'npm', 'drive', 'dropbox',
    'trello', 'zoom', 'outlook', 'calendar', 'maps', 'translate', 'canva',
    'codepen', 'codesandbox', 'replit', 'medium', 'wikipedia', 'twitch', 'yt', 'gh',
];
const SITE_RE = new RegExp(`^(?:open|go to|visit|navigate to|browse to)\\s+(?:(?:the|my)\\s+)?(?:website\\s+)?(?:site\\s+)?(${SITE_NAMES.map((n) => n.replace('.', '\\.')).join('|')})\\s*$`);
const URL_RE = /^(?:open|go to|visit|navigate to|browse to)\s+(https?:\/\/[^\s]+)$/;
const DOMAIN_RE = /^(?:open|go to|visit|navigate to|browse to)\s+([\w-]+\.[\w.]{2,})$/;
function matchBrowser(s, raw) {
    const urlM = s.match(URL_RE);
    if (urlM) {
        console.log(`[JARVIS_NLP] matched browser.url — ${urlM[1]}`);
        return make('browser.url', { url: urlM[1] }, raw, 0.97, `Open ${urlM[1]}`);
    }
    const siteM = s.match(SITE_RE);
    if (siteM) {
        console.log(`[JARVIS_NLP] matched browser.url (site) — ${siteM[1]}`);
        return make('browser.url', { site: siteM[1] }, raw, 0.95, `Open ${siteM[1]}`);
    }
    const domainM = s.match(DOMAIN_RE);
    if (domainM) {
        console.log(`[JARVIS_NLP] matched browser.url (domain) — ${domainM[1]}`);
        return make('browser.url', { url: domainM[1] }, raw, 0.9, `Open ${domainM[1]}`);
    }
    const searchVerbs = /^(?:search|google|search for|look up|bing|find on google|google for)\s+/;
    if (searchVerbs.test(s)) {
        const query = s.replace(searchVerbs, '').replace(/^for\s+/, '').trim();
        if (query.length > 0) {
            console.log(`[JARVIS_NLP] matched browser.search — "${query}"`);
            return make('browser.search', { query }, raw, 0.93, `Search "${query}"`);
        }
    }
    // "search youtube for X"
    const ytSearch = s.match(/^(?:search|look up)\s+(?:on\s+)?youtube\s+(?:for\s+)?(.+)$/);
    if (ytSearch) {
        return make('browser.search', { query: ytSearch[1], engine: 'youtube' }, raw, 0.95, `YouTube "${ytSearch[1]}"`);
    }
    return null;
}
// ─── Domain: Window info ─────────────────────────────────────────────────────
function matchWindowInfo(s, raw) {
    if (/^(list|show|what'?s?)\s+(all\s+)?(open|running|active)\s+(apps?|applications?|windows?|programs?)/.test(s)) {
        return make('window.list', {}, raw, 0.93, 'List running apps');
    }
    if (/^(what|which)\s+(app|application|window|program)\s+(is\s+)?(active|open|focused|foreground)/.test(s)) {
        return make('window.info', {}, raw, 0.9, 'Active window info');
    }
    return null;
}
// ─── Domain: Contextual commands (Phase 4) ───────────────────────────────────
//
// These use runtime session state ("close it", "switch back", "what am I on")
// and are matched BEFORE generic app control to avoid false positives.
function matchContextual(s, raw) {
    // "what app am I using?" / "what am I using?" / "what's active?"
    if (/^what('?s?|'s| app| is| am i)? ?(am i using|is (open|active|focused|running|in front))?$/.test(s) ||
        /^which (app|application|program|window) (is|am i) ?(active|open|focused|using|in front|currently)?/.test(s) ||
        /^what (app|program|application|window) (is|am i) ?(i'?m?\s*)?(using|in|on|focused on)?/.test(s) ||
        s === 'what am i using' ||
        s === 'what app am i using' ||
        s === "what's active" ||
        s === 'what is active' ||
        s === 'current app' ||
        s === 'active app' ||
        s === 'active window') {
        console.log('[JARVIS_NLP] matched window.info (contextual — what am I using)');
        return make('window.info', {}, raw, 0.97, 'What app am I using?');
    }
    // "close it" / "close this" / "close current app/window"
    if (/^close (it|this|current( app| window| tab)?|the current( app| window)?)$/.test(s) ||
        s === 'close current app' ||
        s === 'close current window' ||
        s === 'close this' ||
        s === 'close it') {
        console.log('[JARVIS_NLP] matched app.close (contextual — close active app)');
        return make('app.close', { contextual: 'active' }, raw, 0.95, 'Close current app');
    }
    // "switch back" / "go back" / "previous app"
    if (/^(switch back|go back|back to previous|previous app|switch to previous( app| window)?|go to previous)/.test(s) ||
        s === 'switch back' ||
        s === 'go back' ||
        s === 'previous app') {
        console.log('[JARVIS_NLP] matched app.focus (contextual — switch to previous)');
        return make('app.focus', { contextual: 'previous' }, raw, 0.95, 'Switch to previous app');
    }
    // "reopen it" / "open it again" / "reopen that" / "launch it again"
    if (/^(reopen|re-open|open (it |that )?again|launch (it |that )?again|reopen (it|that))/.test(s) ||
        s === 'reopen it' ||
        s === 'reopen that' ||
        s === 'open it again') {
        console.log('[JARVIS_NLP] matched app.open (contextual — reopen last app)');
        return make('app.open', { contextual: 'last' }, raw, 0.92, 'Reopen last app');
    }
    // "minimize it" / "minimize this"
    if (/^minimize (it|this|current( app| window)?)$/.test(s) || s === 'minimize it') {
        return make('app.minimize', { contextual: 'active' }, raw, 0.93, 'Minimize current app');
    }
    // "maximize it" / "maximize this"
    if (/^(maximize|maximise|fullscreen) (it|this|current( app| window)?)$/.test(s)) {
        return make('app.maximize', { contextual: 'active' }, raw, 0.93, 'Maximize current app');
    }
    return null;
}
// ─── Domain: Agent planning ───────────────────────────────────────────────────
const AGENT_RE = [
    /^(?:set up|setup|prepare|start)\s+(?:my\s+)?(.+?)\s+(?:setup|environment|workspace|session)$/,
    /^(?:open everything for|launch everything for|start everything for)\s+(.+)$/,
    /^my\s+(.+?)\s+(?:work\s+)?setup$/,
];
function matchAgent(s, raw) {
    for (const re of AGENT_RE) {
        const m = s.match(re);
        if (m) {
            console.log(`[JARVIS_NLP] matched agent.plan — goal="${m[1]}"`);
            return make('agent.plan', { goal: raw }, raw, 0.85, `Plan: ${m[1]}`);
        }
    }
    return null;
}
// ─── Main entry point ─────────────────────────────────────────────────────────
/**
 * Route natural language text to a typed intent.
 * Returns null if no pattern matches → caller invokes Gemini.
 */
export function routeIntent(rawInput) {
    if (!rawInput?.trim() || rawInput.trim().length < 2)
        return null;
    const s = normalise(rawInput);
    if (s.length < 2)
        return null;
    console.log(`[JARVIS_NLP] routing: "${s}"`);
    const result = matchSystem(s, rawInput) // always highest priority (volume, screenshot …)
        ?? matchContextual(s, rawInput) // contextual: "close it", "switch back", "what am I using"
        ?? matchFolderOpen(s, rawInput) // "open downloads/desktop/…"
        ?? matchBrowser(s, rawInput) // URLs and searches
        ?? matchApp(s, rawInput) // open/close/focus app — uses alias table
        ?? matchFile(s, rawInput) // create/delete/move/rename
        ?? matchWindowInfo(s, rawInput)
        ?? matchAgent(s, rawInput)
        ?? null;
    if (result) {
        console.log(`[JARVIS_NLP] resolved → type="${result.type}" params=${JSON.stringify(result.params)} risk="${result.riskLevel}"`);
    }
    else {
        console.log(`[JARVIS_NLP] no match — falling through to Gemini`);
    }
    return result;
}
export function isDesktopCommand(raw) {
    return routeIntent(raw) !== null;
}
