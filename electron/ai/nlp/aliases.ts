/**
 * App Alias Registry — Phase 7
 *
 * Canonical map of every natural-language name a user might say for a given app.
 * Key  = the internal appKey used in appRegistry.ts.
 * Values = all accepted natural-language aliases (lowercase, trimmed).
 *
 * Design rules:
 *  • Include formal names, shortened names, descriptive names, possessive forms.
 *  • Prefer false-positives (route to a plausible app) over false-negatives (fail).
 *  • For generic category terms (e.g. "browser") use the most common app as default.
 */

export const APP_ALIASES: Record<string, string[]> = {

  // ── Browsers ──────────────────────────────────────────────────────────────
  brave: [
    'brave', 'brave browser', 'brave web browser',
  ],
  chrome: [
    'chrome', 'google chrome', 'chrome browser', 'google browser',
    // Generic "browser" terms default to Chrome
    'browser', 'my browser', 'the browser', 'a browser',
    'internet', 'the internet', 'internet browser',
    'web', 'web browser', 'my web browser',
    'go online', 'open internet',
  ],
  edge: [
    'edge', 'microsoft edge', 'ms edge', 'edge browser',
    'new edge', 'chromium edge',
  ],
  firefox: [
    'firefox', 'mozilla firefox', 'mozilla', 'firefox browser',
    'ff',
  ],
  opera: [
    'opera', 'opera browser', 'opera gx', 'opera gaming',
  ],

  // ── Code editors / IDEs ───────────────────────────────────────────────────
  cursor: [
    'cursor', 'cursor ai', 'cursor editor', 'cursor ide', 'cursor app',
    'ai editor', 'ai code editor', 'ai ide',
  ],
  vscode: [
    'vscode', 'vs code', 'visual studio code', 'code', 'vs-code',
    // Generic editor terms → VS Code
    'editor', 'my editor', 'the editor', 'code editor',
    'my code editor', 'my ide', 'ide', 'text editor pro',
    'coding app', 'programming app', 'programming editor',
    'dev editor', 'dev tool', 'development editor',
    'visual studio',
  ],
  sublimetext: [
    'sublime text', 'sublime', 'subl', 'sublime text editor',
  ],
  notepadpp: [
    'notepad++', 'notepad plus', 'notepad plus plus', 'npp',
    'notepad pp',
  ],

  // ── Terminal / Shell ──────────────────────────────────────────────────────
  windowsterminal: [
    'windows terminal', 'terminal', 'wt', 'win terminal',
    'my terminal', 'the terminal', 'command terminal',
    'shell', 'console',
  ],
  powershell: [
    'powershell', 'pwsh', 'ps shell', 'windows powershell',
    'power shell',
  ],
  cmd: [
    'cmd', 'command prompt', 'command line', 'dos', 'cmd prompt',
    'dos prompt',
  ],

  // ── Productivity / Office ─────────────────────────────────────────────────
  word: [
    'word', 'microsoft word', 'ms word',
    'word processor', 'word document', 'doc editor', 'document editor',
  ],
  excel: [
    'excel', 'microsoft excel', 'ms excel',
    'spreadsheet', 'spreadsheet app', 'sheets',
  ],
  powerpoint: [
    'powerpoint', 'ppt', 'microsoft powerpoint', 'ms powerpoint',
    'presentation', 'presentation app', 'slides',
  ],
  outlook: [
    'outlook', 'microsoft outlook', 'ms outlook', 'outlook mail',
    // Generic email terms → Outlook
    'email', 'mail', 'my email', 'my mail', 'email app', 'email client',
    'mailbox', 'inbox',
  ],
  notepad: [
    'notepad', 'note pad', 'notes', 'notepad app',
    'quick notes', 'text file', 'plain text editor', 'txt editor',
  ],

  // ── Communication ─────────────────────────────────────────────────────────
  discord: [
    'discord', 'discord app', 'dc',
    'gaming chat', 'voice chat app', 'gaming voice',
  ],
  slack: [
    'slack', 'slack app', 'slack workspace',
    'work chat', 'team chat',
  ],
  teams: [
    'teams', 'microsoft teams', 'ms teams', 'teams app',
    'team meeting', 'work meeting',
  ],
  telegram: [
    'telegram', 'tg', 'telegram desktop', 'tg app',
    'telegram messenger',
  ],
  whatsapp: [
    'whatsapp', 'whats app', "what's app", 'whats-app', 'wa',
    'whatsapp desktop', 'whatsapp messenger',
  ],
  skype: [
    'skype', 'microsoft skype', 'skype app',
  ],
  zoom: [
    'zoom', 'zoom meeting', 'zoom app', 'zoom call',
    'video call', 'video meeting',
  ],

  // ── Media / Entertainment ─────────────────────────────────────────────────
  spotify: [
    'spotify', 'spotify music', 'spotify app',
    // Generic music terms → Spotify
    'music', 'music app', 'music player', 'my music', 'play music',
    'songs', 'audio player',
  ],
  vlc: [
    'vlc', 'vlc player', 'vlc media player',
    // Generic video player → VLC
    'video player', 'media player', 'media app',
    'movie player', 'play video',
  ],
  obs: [
    'obs', 'obs studio', 'screen recorder', 'obs recorder',
    'recording software', 'stream software', 'streaming app',
  ],

  // ── Creative / Design ─────────────────────────────────────────────────────
  photoshop: [
    'photoshop', 'adobe photoshop', 'ps photoshop', 'ps',
    'photo editor', 'image editor', 'adobe ps',
  ],
  illustrator: [
    'illustrator', 'adobe illustrator', 'ai illustrator',
    'vector editor', 'adobe ai',
  ],
  figma: [
    'figma', 'figma app', 'figma design', 'design tool', 'ui design',
  ],
  paint: [
    'paint', 'ms paint', 'microsoft paint', 'mspaint',
    'paint app', 'windows paint',
  ],

  // ── System / Utilities ────────────────────────────────────────────────────
  calculator: [
    'calculator', 'calc', 'calculation', 'calc app',
    'math', 'math app', 'math calculator', 'windows calculator',
  ],
  explorer: [
    'file explorer', 'explorer', 'windows explorer', 'files', 'folders',
    'my computer', 'this pc', 'my pc', 'file manager', 'explorer.exe',
    'browse files', 'file browser', 'files app',
  ],
  taskmanager: [
    'task manager', 'taskmgr', 'task mgr', 'process manager',
    'processes', 'system processes', 'kill process', 'task management',
  ],
  snipping: [
    'snipping tool', 'snip', 'snipping', 'snip tool', 'screen snip',
    'screenshot tool',
  ],

  // ── Development Tools ─────────────────────────────────────────────────────
  postman: [
    'postman', 'postman api', 'api testing', 'api client',
  ],
  docker: [
    'docker', 'docker desktop', 'container app', 'containers',
  ],

  // ── Social / Gaming ───────────────────────────────────────────────────────
  steam: [
    'steam', 'steam client', 'steam launcher', 'steam games', 'gaming',
  ],
  epicgames: [
    'epic games', 'epic', 'epic games launcher', 'epic launcher',
    'epic store',
  ],
}

// ─── Flat reverse map: alias → appKey ────────────────────────────────────────

/** Built once at module load — alias (lowercase) → canonical appKey */
export const ALIAS_TO_KEY = new Map<string, string>()
for (const [key, aliases] of Object.entries(APP_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_KEY.set(alias.toLowerCase().trim(), key)
  }
}

// ─── Resolution helpers ───────────────────────────────────────────────────────

/**
 * Resolve a natural-language phrase to a canonical appKey.
 * Resolution order: exact → prefix → substring.
 */
export function resolveAppKey(phrase: string): string | null {
  const p = phrase.trim().toLowerCase()
  if (!p) return null

  // 1. Exact match
  const exact = ALIAS_TO_KEY.get(p)
  if (exact) return exact

  // 2. Phrase starts with a known alias
  for (const [alias, key] of ALIAS_TO_KEY) {
    if (p.startsWith(`${alias} `) || p === alias) return key
  }

  // 3. A known alias is contained within the phrase
  for (const [alias, key] of ALIAS_TO_KEY) {
    if (p.includes(alias)) return key
  }

  return null
}

/**
 * Return ALL appKeys whose aliases partially match the phrase.
 * Used for ambiguity detection and clarification messages.
 */
export function getAppCandidates(phrase: string): string[] {
  const p = phrase.trim().toLowerCase()
  if (!p) return []

  const found = new Set<string>()

  for (const [alias, key] of ALIAS_TO_KEY) {
    if (p === alias || p.includes(alias) || alias.includes(p)) {
      found.add(key)
    }
  }

  return [...found]
}
