/**
 * Action Guard — Phase 7
 *
 * Risk-level classification and confirmation gate for all desktop actions.
 *
 * Risk levels:
 *   safe     — execute immediately, no prompt
 *   low      — execute with audit log only
 *   medium   — warn in chat response but execute
 *   high     — require Electron dialog confirmation before execution
 *   critical — require dialog + abort window (shutdown, format, etc.)
 *
 * The guard is stateless: it returns a decision that the caller acts on.
 */
import { dialog } from 'electron';
const RISK_MAP = {
    // App control — all safe unless it's a system process
    'app.open': 'safe',
    'app.close': 'low',
    'app.focus': 'safe',
    'app.minimize': 'safe',
    'app.maximize': 'safe',
    'app.restart': 'low',
    'app.switch': 'safe',
    // File system
    'file.open': 'safe',
    'file.create': 'low',
    'file.rename': 'low',
    'file.move': 'low',
    'file.delete': 'high', // always confirm
    'file.search': 'safe',
    'folder.open': 'safe',
    'folder.create': 'low',
    // System
    'system.volume': 'safe',
    'system.brightness': 'safe',
    'system.screenshot': 'safe',
    'system.clipboard': 'safe',
    'system.lock': 'safe',
    'system.wifi': 'low',
    'system.bluetooth': 'low',
    'system.recycle': 'high', // empties recycle bin — confirm
    'system.sleep': 'medium',
    'system.shutdown': 'critical',
    'system.restart': 'critical',
    // Browser — all safe
    'browser.url': 'safe',
    'browser.search': 'safe',
    // Window info — safe
    'window.list': 'safe',
    'window.info': 'safe',
    // Agent planning — low (individual steps guarded separately)
    'agent.plan': 'low',
};
export function getRiskLevel(intentType) {
    return RISK_MAP[intentType] ?? 'low';
}
/**
 * Synchronously returns the risk level. Use `confirmIfRequired` for async dialog.
 */
export function assessRisk(intentType) {
    return getRiskLevel(intentType);
}
/**
 * For high/critical intents, shows a native Electron confirmation dialog.
 * Returns { proceed: true } if the user confirms, { proceed: false } if they cancel.
 * For safe/low/medium intents, always returns { proceed: true }.
 */
export async function confirmIfRequired(intentType, description) {
    const risk = getRiskLevel(intentType);
    if (risk === 'safe' || risk === 'low' || risk === 'medium') {
        return { proceed: true };
    }
    // high / critical — show native dialog
    const isCritical = risk === 'critical';
    const buttons = isCritical ? ['Cancel', 'Confirm'] : ['Cancel', 'Yes, proceed'];
    const defaultId = 0; // default to Cancel
    const result = await dialog.showMessageBox({
        type: isCritical ? 'warning' : 'question',
        buttons,
        defaultId,
        cancelId: 0,
        title: isCritical ? '⚠️ Critical Action — Confirm?' : 'Confirm Action',
        message: isCritical
            ? `CRITICAL: ${description}`
            : `Confirm: ${description}`,
        detail: isCritical
            ? 'This action cannot be undone. Are you absolutely sure?'
            : 'This action may be difficult to reverse.',
    });
    if (result.response === 1)
        return { proceed: true };
    return { proceed: false, reason: 'Action cancelled by user.' };
}
/**
 * Convenience: check risk and confirm in one call.
 * Returns { proceed: true } for safe/low/medium without any dialog.
 */
export async function guard(intentType, description) {
    return confirmIfRequired(intentType, description);
}
/**
 * Returns a human-readable risk warning for inclusion in chat responses (medium risk).
 */
export function riskWarningText(risk, description) {
    if (risk === 'medium') {
        return `⚠️ Note: ${description} — proceeding.`;
    }
    return null;
}
