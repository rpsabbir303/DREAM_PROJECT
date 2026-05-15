/**
 * NLP Router — Phase 7
 *
 * Converts natural language into a typed ResolvedIntent via deterministic
 * pattern matching + fuzzy alias resolution. No LLM required for supported commands.
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
 *
 * Input normalization pipeline (runs BEFORE matching):
 *   stripCommandPreamble → basicClean → removeFillerWords
 *   → applyDesirePatterns → normalizeAppTokens → CONVERSATIONAL_PREFIXES loop
 */
import { safeLogger } from '../main/safeLogger.js';
import { stripCommandPreamble } from './commandContext.js';
import { getRiskLevel } from '../security/actionGuard.js';
import { fuzzyResolveSync } from '../system/appDiscovery.js';
import { normalizeInput, normalizeAppTokens } from './nlp/normalize.js';
import { resolveAppKey, getAppCandidates } from './nlp/aliases.js';
import { fuzzyMatchAppKey } from './nlp/fuzzyMatcher.js';
import { classifyPrimaryIntent, MIN_DISCOVERY_QUERY_LEN, MIN_FUZZY_TARGET_LEN } from './nlp/intentClassifier.js';
// ─── Builder ─────────────────────────────────────────────────────────────────
function make(type, params, rawInput, confidence, displayLabel) {
    return { type, params, rawInput, confidence, riskLevel: getRiskLevel(type), displayLabel };
}
// ─── Normaliser ───────────────────────────────────────────────────────────────
/** Below this → route to Gemini chat, never execute automation. */
export const DESKTOP_INTENT_CONFIDENCE_FLOOR = 0.70;
/** At or above this → execute immediately. Between floor and this → clarify first. */
export const DESKTOP_INTENT_AUTO_EXECUTE = 0.90;
const CONVERSATIONAL_PREFIXES = [
    /^i\s+say\s+/,
    /^i\s+said\s+/,
    /^tell\s+me\s+to\s+/,
    /^go\s+ahead\s+and\s+/,
    /^just\s+/,
    /^um\s+/,
    /^uh\s+/,
];
const DESKTOP_VERB_RE = /\b(open|launch|start|run|close|quit|exit|stop|switch\s+to|go\s+to|focus(?:\s+on)?|activate|minimize|minimise|maximize|maximise|restart|relaunch)\s+(.+)$/i;
/**
 * Full normalization pipeline:
 *   1. stripCommandPreamble — "hey jarvis", "can you", "please" …
 *   2. normalizeInput       — basicClean + removeFillerWords + applyDesirePatterns + normalizeAppTokens
 *   3. CONVERSATIONAL_PREFIXES loop — remaining noise
 *   4. Another pass of stripCommandPreamble + normalizeAppTokens
 */
function normalise(raw) {
    // Step 1: remove address/politeness prefixes
    let s = stripCommandPreamble(raw);
    // Step 2: full NLP pipeline (desire patterns, filler, app token fixes)
    s = normalizeInput(s);
    // Step 3: loop away any remaining conversational noise
    let prev = '';
    while (prev !== s) {
        prev = s;
        for (const re of CONVERSATIONAL_PREFIXES) {
            s = s.replace(re, '').trim();
        }
        s = stripCommandPreamble(s);
        s = normalizeAppTokens(s);
    }
    return s.trim();
}
/** If a desktop verb appears mid-utterance, peel to "verb …" form. */
function peelToLeadingCommand(s) {
    const m = s.match(DESKTOP_VERB_RE);
    if (!m)
        return s;
    const verb = m[1].replace(/\s+/g, ' ');
    const rest = m[2].trim();
    const peeled = `${verb} ${rest}`.trim();
    if (peeled.length >= 4 && peeled !== s && !s.startsWith(`${verb} `)) {
        safeLogger.info(`[JARVIS_NLP] peeled embedded command → "${peeled}"`);
        return peeled;
    }
    return s;
}
function blocksGeminiFallback(intent) {
    return intent !== null && intent.confidence >= DESKTOP_INTENT_AUTO_EXECUTE;
}
// ─── App alias resolution ─────────────────────────────────────────────────────
//
// Alias table, reverse map, and resolveAppKey are now in ./nlp/aliases.ts.
// This wrapper adds fuzzy fallback via ./nlp/fuzzyMatcher.ts.
/**
 * Resolve a phrase to an appKey:
 *   1. Static alias table (exact / prefix / substring)  — aliases.ts
 *   2. Fuzzy match (typos, near-misses)                  — fuzzyMatcher.ts
 * Returns null if nothing is confident enough.
 */
// ─── Verb groups ──────────────────────────────────────────────────────────────
const V_OPEN = /^(open|launch|start|run|fire up|bring up|pull up|load|open up|get|start up|boot|spin up|use|access|go to|visit|navigate to|try)\s+/;
const V_CLOSE = /^(close|quit|exit|stop|kill|end|terminate|shut|force close|force quit|kill off|shut down)\s+/;
const V_FOCUS = /^(focus|switch to|go to|switch|activate|bring|show|navigate to|jump to|go back to|return to)\s+(the\s+|my\s+)?/;
const V_MINIMIZE = /^(minimize|minimise|hide|send to taskbar|collapse|shrink)\s+(the\s+|my\s+)?/;
const V_MAXIMIZE = /^(maximize|maximise|fullscreen|full screen|expand|restore|make full|enlarge|make bigger)\s+(the\s+|my\s+)?/;
const V_RESTART = /^(restart|relaunch|reload|reopen|reset|refresh)\s+(the\s+|my\s+)?/;
const ARTICLE = /^(the|my|a|an|some)\s+/;
function stripVerb(s, re) {
    const m = s.match(re);
    if (!m)
        return null;
    return s.slice(m[0].length).replace(ARTICLE, '').trim();
}
// ─── Domain: App control ──────────────────────────────────────────────────────
/**
 * Resolve an app phrase using the full resolution chain:
 *   1. Static alias table (exact/prefix/substring) + fuzzy typo matching
 *   2. Live discovery registry (system-installed apps, sync cache)
 */
/** WhatsApp / common typo phrases — always resolve before discovery fuzzy. */
function resolveKnownAppPhrase(phrase) {
    const p = normalizeAppTokens(phrase.trim().toLowerCase());
    if (/^(what'?s?\s*app|what'?app|whats?\s*app|what\s+s\s+app|whatsapp|wa)$/i.test(p))
        return 'whatsapp';
    if (/^(chrome|google\s*chrome|chorme|chrom)$/i.test(p))
        return 'chrome';
    if (/^(vscode|vs\s*code|visual\s*studio\s*code)$/i.test(p))
        return 'vscode';
    if (/^(notepad|note\s*pad)$/i.test(p))
        return 'notepad';
    if (/^(explorer|file\s*explorer|files)$/i.test(p))
        return 'explorer';
    return null;
}
/** Windows discovery sometimes surfaces help/update strings as "apps". */
function isJunkDiscoveryName(canonicalName) {
    const n = canonicalName.toLowerCase();
    if (/\b(what\s+is\s+new|latest\s+version|release\s+notes|getting\s+started)\b/i.test(n))
        return true;
    if (/\b(is|are|was|will|can)\b/.test(n) && n.split(/\s+/).length >= 4)
        return true;
    return false;
}
/** Reject discovery/shell matches that are clearly not app names. */
function isPlausibleAppTarget(phrase) {
    const p = phrase.trim().toLowerCase();
    if (!p || p.length < 2)
        return false;
    if (/\b(is|are|was|will|can|should|would)\b/.test(p) && p.split(/\s+/).length >= 3)
        return false;
    if (/\b(what\s+is|latest\s+version|new\s+in|is\s+new)\b/i.test(p))
        return false;
    if (/^what\s+app$/i.test(p))
        return false; // use resolveKnownAppPhrase instead
    if (p.split(/\s+/).length > 4)
        return false;
    return true;
}
function resolveAppTarget(phrase) {
    const p = normalizeAppTokens(phrase.trim());
    if (p.length < MIN_FUZZY_TARGET_LEN) {
        return null;
    }
    const known = resolveKnownAppPhrase(p);
    if (known)
        return { appKey: known };
    if (!isPlausibleAppTarget(p)) {
        safeLogger.info(`[JARVIS_NLP] reject implausible target — "${p}"`);
        return null;
    }
    // 1. Alias table + fuzzy (stricter threshold for short targets)
    const fuzzyThreshold = p.length <= 5 ? 0.88 : 0.65;
    const staticKey = resolveAppKey(p);
    if (staticKey)
        return { appKey: staticKey };
    const fuzzy = fuzzyMatchAppKey(p, fuzzyThreshold);
    if (fuzzy)
        return { appKey: fuzzy.key };
    // 2. Live discovery registry (never for queries under 4 chars)
    if (p.length >= MIN_DISCOVERY_QUERY_LEN) {
        const minScore = p.length <= 5 ? 85 : 60;
        const discovered = fuzzyResolveSync(p, minScore);
        if (discovered && !isJunkDiscoveryName(discovered.app.canonicalName)) {
            safeLogger.info(`[JARVIS_NLP] discovery match — "${phrase}" → "${discovered.app.canonicalName}" (score=${discovered.score})`);
            return { discoveryName: discovered.app.canonicalName };
        }
        if (discovered) {
            safeLogger.info(`[JARVIS_NLP] rejected junk discovery — "${discovered.app.canonicalName}" for "${phrase}"`);
        }
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
    const normTarget = (phrase) => normalizeAppTokens(phrase.trim());
    // Open
    if ((target = stripVerb(s, V_OPEN)) !== null) {
        target = normTarget(target);
        const resolved = resolveAppTarget(target);
        if (resolved) {
            const { appKey, discoveryName } = resolved;
            const params = { app: target };
            if (appKey)
                params.appKey = appKey;
            if (discoveryName)
                params.discoveryName = discoveryName;
            // Detect ambiguity: if the phrase is very generic (e.g. "editor") and
            // maps to multiple candidates, annotate with alternatives for a helpful message.
            const candidates = getAppCandidates(target).filter((k) => k !== (appKey ?? discoveryName));
            if (candidates.length >= 2 && target.split(' ').length <= 2) {
                params.alternatives = candidates.slice(0, 3).join(',');
                safeLogger.info(`[JARVIS_NLP] ambiguous open — target="${target}" candidates=[${candidates.slice(0, 3).join(', ')}]`);
            }
            const label = appKey ?? discoveryName ?? target;
            safeLogger.info(`[JARVIS_NLP] matched app.open — raw="${target}" key="${appKey ?? '—'}" discovery="${discoveryName ?? '—'}"`);
            return make('app.open', params, raw, 0.95, `Open ${label}`);
        }
        // Only open with appKey from aliases — never shell-launch unknown multi-word phrases
        const knownOnly = resolveKnownAppPhrase(target);
        if (knownOnly) {
            return make('app.open', { app: target, appKey: knownOnly }, raw, 0.95, `Open ${knownOnly}`);
        }
        return null;
    }
    // Close
    if ((target = stripVerb(s, V_CLOSE)) !== null) {
        target = normTarget(target);
        const resolved = resolveAppTarget(target);
        if (resolved) {
            const params = { app: target, ...(resolved.appKey ? { appKey: resolved.appKey } : {}) };
            safeLogger.info(`[JARVIS_NLP] matched app.close — raw="${target}" key="${resolved.appKey ?? '—'}"`);
            return make('app.close', params, raw, 0.95, `Close ${target}`);
        }
        if (looksLikeAppName(target)) {
            return make('app.close', { app: target }, raw, 0.82, `Close ${target}`);
        }
        return null;
    }
    // Focus / switch
    if ((target = stripVerb(s, V_FOCUS)) !== null) {
        target = normTarget(target);
        const resolved = resolveAppTarget(target);
        const params = { app: target, ...(resolved?.appKey ? { appKey: resolved.appKey } : {}) };
        safeLogger.info(`[JARVIS_NLP] matched app.focus — raw="${target}"`);
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
    // ── Bare app name (no verb) — DISABLED for safety ───────────────────────
    // Bare names like "chrome" without a verb caused false positives ("hi" → history).
    // Users must say "open chrome". Unknown bare names fall through to Gemini chat.
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
    safeLogger.info(`[JARVIS_NLP] matched folder.open — folder="${key}"`);
    return make('folder.open', { folder: key }, raw, 0.95, `Open ${key}`);
}
// ─── Domain: File operations ──────────────────────────────────────────────────
function matchFile(s, raw) {
    // Create folder
    const mkdirMatch = s.match(/^(?:create|make|new)\s+(?:a\s+)?(?:new\s+)?folder\s+(?:called|named|with name)?\s*"?([^"]+)"?$/);
    if (mkdirMatch) {
        const name = mkdirMatch[1].trim();
        safeLogger.info(`[JARVIS_NLP] matched folder.create — name="${name}"`);
        return make('folder.create', { name }, raw, 0.92, `Create folder "${name}"`);
    }
    // Create file
    const mkfileMatch = s.match(/^(?:create|make|new)\s+(?:a\s+)?(?:new\s+)?(?:text\s+|empty\s+)?file\s+(?:called|named|with name)?\s*"?([^"]+)"?$/);
    if (mkfileMatch) {
        const name = mkfileMatch[1].trim();
        safeLogger.info(`[JARVIS_NLP] matched file.create — name="${name}"`);
        return make('file.create', { name }, raw, 0.92, `Create file "${name}"`);
    }
    // Search
    const searchMatch = s.match(/^(?:search|find|look for|locate|search for)\s+(?:files?\s+(?:called|named)?\s+)?(?:for\s+)?"?([^"]{2,80})"?$/);
    if (searchMatch) {
        const query = searchMatch[1].trim();
        safeLogger.info(`[JARVIS_NLP] matched file.search — query="${query}"`);
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
        safeLogger.info('[JARVIS_NLP] matched system.volume mute');
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
        safeLogger.info('[JARVIS_NLP] matched system.screenshot');
        return make('system.screenshot', {}, raw, 0.97, 'Take screenshot');
    }
    // Lock
    if (/^(lock|lock (the )?(pc|computer|screen|windows|machine|workstation)|lock screen)/.test(s)) {
        safeLogger.info('[JARVIS_NLP] matched system.lock');
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
        safeLogger.info(`[JARVIS_NLP] matched browser.url — ${urlM[1]}`);
        return make('browser.url', { url: urlM[1] }, raw, 0.97, `Open ${urlM[1]}`);
    }
    const siteM = s.match(SITE_RE);
    if (siteM) {
        safeLogger.info(`[JARVIS_NLP] matched browser.url (site) — ${siteM[1]}`);
        return make('browser.url', { site: siteM[1] }, raw, 0.95, `Open ${siteM[1]}`);
    }
    const domainM = s.match(DOMAIN_RE);
    if (domainM) {
        safeLogger.info(`[JARVIS_NLP] matched browser.url (domain) — ${domainM[1]}`);
        return make('browser.url', { url: domainM[1] }, raw, 0.9, `Open ${domainM[1]}`);
    }
    const searchVerbs = /^(?:search|google|search for|look up|bing|find on google|google for)\s+/;
    if (searchVerbs.test(s)) {
        const query = s.replace(searchVerbs, '').replace(/^for\s+/, '').trim();
        if (query.length > 0) {
            safeLogger.info(`[JARVIS_NLP] matched browser.search — "${query}"`);
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
        safeLogger.info('[JARVIS_NLP] matched window.info (contextual — what am I using)');
        return make('window.info', {}, raw, 0.97, 'What app am I using?');
    }
    // "close it" / "close this" / "close current app/window"
    if (/^close (it|this|current( app| window| tab)?|the current( app| window)?)$/.test(s) ||
        s === 'close current app' ||
        s === 'close current window' ||
        s === 'close this' ||
        s === 'close it') {
        safeLogger.info('[JARVIS_NLP] matched app.close (contextual — close active app)');
        return make('app.close', { contextual: 'active' }, raw, 0.95, 'Close current app');
    }
    // "switch back" / "go back" / "previous app"
    if (/^(switch back|go back|back to previous|previous app|switch to previous( app| window)?|go to previous)/.test(s) ||
        s === 'switch back' ||
        s === 'go back' ||
        s === 'previous app') {
        safeLogger.info('[JARVIS_NLP] matched app.focus (contextual — switch to previous)');
        return make('app.focus', { contextual: 'previous' }, raw, 0.95, 'Switch to previous app');
    }
    // "reopen it" / "open it again" / "reopen that" / "launch it again"
    if (/^(reopen|re-open|open (it |that )?again|launch (it |that )?again|reopen (it|that))/.test(s) ||
        s === 'reopen it' ||
        s === 'reopen that' ||
        s === 'open it again') {
        safeLogger.info('[JARVIS_NLP] matched app.open (contextual — reopen last app)');
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
    // "set up my work setup", "prepare my dev environment"
    /^(?:set up|setup|prepare|start|begin|initialize|init)\s+(?:my\s+)?(.+?)\s+(?:setup|environment|workspace|session|mode|flow)$/,
    // "open everything for work", "launch everything for my meeting"
    /^(?:open|launch|start|run)\s+everything\s+(?:for\s+)?(?:my\s+)?(.+)$/,
    // "my work setup", "my dev workspace"
    /^my\s+(.+?)\s+(?:work\s+)?(?:setup|workspace|environment|session)$/,
    // "prepare work setup", "start developer mode"
    /^(?:prepare|start|begin)\s+(?:my\s+)?(.+?)\s+(?:setup|mode|workflow)$/,
    // "get my morning apps", "load my work apps"
    /^(?:get|load|open)\s+(?:all\s+)?(?:my\s+)?(.+?)\s+apps?$/,
    // natural: "i need to start working", "time to get to work"
    /^(?:i(?:'m|\s+am)\s+(?:ready\s+)?to\s+(?:start\s+)?|time\s+to\s+get\s+to\s+|let(?:'s|\s+us)\s+(?:get\s+to\s+)?(?:start\s+)?)work(?:ing)?(?:\s+on\s+(.+))?$/,
];
function matchAgent(s, raw) {
    for (const re of AGENT_RE) {
        const m = s.match(re);
        if (m) {
            safeLogger.info(`[JARVIS_NLP] matched agent.plan — goal="${m[1]}"`);
            return make('agent.plan', { goal: raw }, raw, 0.85, `Plan: ${m[1]}`);
        }
    }
    return null;
}
// ─── Heuristic desktop fallback (no Gemini) ─────────────────────────────────
function matchDesktopHeuristic(s, raw) {
    const openM = s.match(/^(?:open|launch|start|run)\s+(?:the\s+|my\s+|a\s+)?(.+)$/i);
    if (openM) {
        const target = normalizeAppTokens(openM[1].trim());
        const resolved = resolveAppTarget(target);
        if (resolved?.appKey || resolved?.discoveryName) {
            const params = { app: target };
            if (resolved.appKey)
                params.appKey = resolved.appKey;
            if (resolved.discoveryName)
                params.discoveryName = resolved.discoveryName;
            safeLogger.info(`[JARVIS_NLP] heuristic app.open — target="${target}"`);
            return make('app.open', params, raw, 0.72, `Open ${target}`);
        }
    }
    const closeM = s.match(/^(?:close|quit|exit|stop)\s+(?:the\s+|my\s+)?(.+)$/i);
    if (closeM) {
        const target = normalizeAppTokens(closeM[1].trim());
        const resolved = resolveAppTarget(target);
        if (resolved?.appKey) {
            const params = { app: target, appKey: resolved.appKey };
            safeLogger.info(`[JARVIS_NLP] heuristic app.close — target="${target}"`);
            return make('app.close', params, raw, 0.72, `Close ${target}`);
        }
    }
    const switchM = s.match(/^(?:switch\s+to|go\s+to|focus(?:\s+on)?|activate)\s+(?:the\s+|my\s+)?(.+)$/i);
    if (switchM) {
        const target = normalizeAppTokens(switchM[1].trim());
        const resolved = resolveAppTarget(target);
        if (resolved?.appKey) {
            const params = { app: target, appKey: resolved.appKey };
            safeLogger.info(`[JARVIS_NLP] heuristic app.focus — target="${target}"`);
            return make('app.focus', params, raw, 0.7, `Focus ${target}`);
        }
    }
    return null;
}
// ─── Domain: Keyboard control ─────────────────────────────────────────────────
const KEY_PRESS_RE = /^(?:press|hit|tap|use|send|trigger|execute)\s+(.+)$/;
const TYPE_RE = /^(?:type|write|input|enter|type\s+out)\s+(?:the\s+(?:text\s+)?)?[""']?(.+?)[""']?$/;
/** Common shortcut name aliases so users don't need to know SendKeys syntax. */
const SHORTCUT_PHRASE_MAP = {
    'save': 'ctrl+s',
    'save file': 'ctrl+s',
    'save it': 'ctrl+s',
    'save the file': 'ctrl+s',
    'copy': 'ctrl+c',
    'copy it': 'ctrl+c',
    'paste': 'ctrl+v',
    'paste it': 'ctrl+v',
    'cut': 'ctrl+x',
    'cut it': 'ctrl+x',
    'undo': 'ctrl+z',
    'undo that': 'ctrl+z',
    'redo': 'ctrl+y',
    'redo that': 'ctrl+y',
    'select all': 'ctrl+a',
    'find': 'ctrl+f',
    'search': 'ctrl+f',
    'open find': 'ctrl+f',
    'print': 'ctrl+p',
    'print page': 'ctrl+p',
    'new tab': 'ctrl+t',
    'open new tab': 'ctrl+t',
    'close tab': 'ctrl+w',
    'close this tab': 'ctrl+w',
    'reopen tab': 'ctrl+shift+t',
    'reopen last tab': 'ctrl+shift+t',
    'refresh': 'f5',
    'reload': 'f5',
    'reload page': 'f5',
    'refresh page': 'f5',
    'fullscreen': 'f11',
    'full screen': 'f11',
    'toggle fullscreen': 'f11',
    'go back': 'alt+left',
    'go forward': 'alt+right',
    'switch windows': 'alt+tab',
    'switch apps': 'alt+tab',
    'alt tab': 'alt+tab',
    'show desktop': 'win+d',
    'minimize all': 'win+d',
    'file explorer': 'win+e',
    'open run': 'win+r',
    'lock': 'win+l',
    'lock screen': 'win+l',
    'lock pc': 'win+l',
    'lock computer': 'win+l',
    'enter': 'enter',
    'press enter': 'enter',
    'press escape': 'escape',
    'escape': 'escape',
};
function matchKeyboard(s, raw) {
    // Explicit shortcut phrases
    const shortcut = SHORTCUT_PHRASE_MAP[s];
    if (shortcut) {
        safeLogger.info(`[JARVIS_NLP] matched keyboard.shortcut via alias — "${s}" → "${shortcut}"`);
        return make('keyboard.shortcut', { key: shortcut }, raw, 0.97, `Press ${shortcut}`);
    }
    // "press ctrl+s" / "hit alt+f4" / "tap enter"
    const pressM = s.match(KEY_PRESS_RE);
    if (pressM) {
        const key = pressM[1].trim();
        // Avoid mis-routing app names like "press chrome" — must look like a key
        if (/^[a-z0-9+\-_ ]{1,30}$/.test(key) && (/[+]/.test(key) || // modifier combo: ctrl+s
            SPECIAL_KEY_NAMES.test(key) ||
            SHORTCUT_PHRASE_MAP[key] !== undefined ||
            key.length <= 3 // single key like "f5", "tab"
        )) {
            const resolved = SHORTCUT_PHRASE_MAP[key] ?? key;
            safeLogger.info(`[JARVIS_NLP] matched keyboard.shortcut — "${key}"`);
            return make('keyboard.shortcut', { key: resolved }, raw, 0.93, `Press ${key}`);
        }
    }
    // "type hello" / "write hello world" / "type the text foo"
    const typeM = s.match(TYPE_RE);
    if (typeM) {
        const text = typeM[1].trim();
        if (text.length >= 1 && text.length <= 500) {
            safeLogger.info(`[JARVIS_NLP] matched keyboard.type — "${text.slice(0, 40)}"`);
            return make('keyboard.type', { text }, raw, 0.92, `Type "${text.slice(0, 30)}"`);
        }
    }
    return null;
}
const SPECIAL_KEY_NAMES = /^(enter|return|escape|esc|tab|backspace|delete|del|space|up|down|left|right|home|end|f\d{1,2}|pgup|pgdn|insert|ins|pageup|pagedown)$/i;
function matchIntentChain(s, raw) {
    return (matchSystem(s, raw)
        ?? matchKeyboard(s, raw)
        ?? matchApp(s, raw)
        ?? matchContextual(s, raw)
        ?? matchFolderOpen(s, raw)
        ?? matchBrowser(s, raw)
        ?? matchFile(s, raw)
        ?? matchWindowInfo(s, raw)
        ?? matchAgent(s, raw)
        ?? matchDesktopHeuristic(s, raw));
}
// ─── Main entry point ─────────────────────────────────────────────────────────
/**
 * Route natural language text to a typed intent.
 * Returns null if no pattern matches → caller invokes Gemini.
 */
export function routeIntent(rawInput) {
    if (!rawInput?.trim() || rawInput.trim().length < 2)
        return null;
    // ── PRIMARY CLASSIFIER (before any app/fuzzy matching) ─────────────────
    const classified = classifyPrimaryIntent(rawInput);
    if (classified.primary === 'CHAT' || classified.primary === 'QUESTION') {
        safeLogger.info(`[JARVIS_NLP] blocked automation — primary=${classified.primary}`);
        return null;
    }
    if (!classified.hasActionVerb && classified.automationScore < 0.5) {
        safeLogger.info(`[JARVIS_NLP] blocked — no action verb`);
        return null;
    }
    const s = normalise(rawInput);
    if (s.length < 2)
        return null;
    safeLogger.info(`[JARVIS_NLP] routing: "${s}"`);
    let result = matchIntentChain(s, rawInput);
    if (!result) {
        const peeled = peelToLeadingCommand(s);
        if (peeled !== s) {
            result = matchIntentChain(peeled, rawInput);
        }
    }
    if (result) {
        safeLogger.info(`[JARVIS_NLP] resolved → type="${result.type}" confidence=${result.confidence} params=${JSON.stringify(result.params)} risk="${result.riskLevel}"`);
        if (blocksGeminiFallback(result)) {
            safeLogger.info(`[JARVIS_NLP] confidence≥${DESKTOP_INTENT_CONFIDENCE_FLOOR} — Gemini fallback blocked`);
        }
    }
    else {
        safeLogger.info('[JARVIS_NLP] no match — may fall through to Gemini for general chat');
    }
    return result;
}
export function isDesktopCommand(raw) {
    return routeIntent(raw) !== null;
}
