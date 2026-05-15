/**
 * Browser Agent — Phase 4
 *
 * Opens URLs and performs web searches via the default browser.
 * Uses Electron's shell.openExternal — no spawned browser process needed.
 */
import { shell } from 'electron';
// ─── Site shortcuts ───────────────────────────────────────────────────────────
const SITE_SHORTCUTS = {
    youtube: 'https://www.youtube.com',
    'yt': 'https://www.youtube.com',
    google: 'https://www.google.com',
    gmail: 'https://mail.google.com',
    github: 'https://github.com',
    'gh': 'https://github.com',
    chatgpt: 'https://chat.openai.com',
    'chat gpt': 'https://chat.openai.com',
    openai: 'https://chat.openai.com',
    gemini: 'https://gemini.google.com',
    notion: 'https://www.notion.so',
    figma: 'https://www.figma.com',
    vercel: 'https://vercel.com',
    netlify: 'https://netlify.com',
    aws: 'https://console.aws.amazon.com',
    azure: 'https://portal.azure.com',
    github_copilot: 'https://github.com/features/copilot',
    twitter: 'https://twitter.com',
    'x': 'https://x.com',
    reddit: 'https://www.reddit.com',
    linkedin: 'https://www.linkedin.com',
    facebook: 'https://www.facebook.com',
    instagram: 'https://www.instagram.com',
    discord: 'https://discord.com',
    slack: 'https://app.slack.com',
    spotify: 'https://open.spotify.com',
    netflix: 'https://www.netflix.com',
    amazon: 'https://www.amazon.com',
    stackoverflow: 'https://stackoverflow.com',
    'stack overflow': 'https://stackoverflow.com',
    mdn: 'https://developer.mozilla.org',
    npm: 'https://www.npmjs.com',
    npmjs: 'https://www.npmjs.com',
    'google drive': 'https://drive.google.com',
    drive: 'https://drive.google.com',
    dropbox: 'https://www.dropbox.com',
    trello: 'https://trello.com',
    jira: 'https://www.atlassian.com/software/jira',
    confluence: 'https://www.atlassian.com/software/confluence',
    zoom: 'https://zoom.us',
    teams: 'https://teams.microsoft.com',
    outlook: 'https://outlook.com',
    calendar: 'https://calendar.google.com',
    maps: 'https://maps.google.com',
    'google maps': 'https://maps.google.com',
    translate: 'https://translate.google.com',
    'google translate': 'https://translate.google.com',
    canva: 'https://www.canva.com',
    codepen: 'https://codepen.io',
    codesandbox: 'https://codesandbox.io',
    replit: 'https://replit.com',
    devto: 'https://dev.to',
    medium: 'https://medium.com',
    wikipedia: 'https://www.wikipedia.org',
    twitch: 'https://www.twitch.tv',
};
const SEARCH_URLS = {
    google: 'https://www.google.com/search?q=',
    youtube: 'https://www.youtube.com/results?search_query=',
    bing: 'https://www.bing.com/search?q=',
    github: 'https://github.com/search?q=',
};
// ─── Public API ───────────────────────────────────────────────────────────────
/** Resolve a site shortcut name to a URL, or null if not found. */
export function resolveSiteShortcut(name) {
    return SITE_SHORTCUTS[name.trim().toLowerCase()] ?? null;
}
/** Open a URL in the default browser. */
export async function openUrl(url) {
    const normalised = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    try {
        await shell.openExternal(normalised);
        return { ok: true, message: `Opened ${normalised} in your browser.` };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: `Could not open URL: ${msg.slice(0, 160)}` };
    }
}
/** Open a named site (site shortcut map). */
export async function openSite(name) {
    const url = resolveSiteShortcut(name);
    if (!url)
        return { ok: false, message: `Unknown site "${name}". Try "open youtube.com" with a full domain.` };
    return openUrl(url);
}
/** Perform a web search using the specified engine (default: Google). */
export async function webSearch(query, engine = 'google') {
    const base = SEARCH_URLS[engine] ?? SEARCH_URLS.google;
    const url = `${base}${encodeURIComponent(query)}`;
    try {
        await shell.openExternal(url);
        return { ok: true, message: `Searching ${engine} for "${query}".` };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, message: `Search failed: ${msg.slice(0, 160)}` };
    }
}
/** Search YouTube directly. */
export async function youtubeSearch(query) {
    return webSearch(query, 'youtube');
}
