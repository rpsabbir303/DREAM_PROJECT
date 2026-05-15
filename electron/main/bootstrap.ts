/**
 * Electron entry — load order is critical.
 * 1. consoleGuard  — global EPIPE protection + console monkey-patch
 * 2. safeLogger    — replace console with file-only logging (never touches stdout)
 * 3. index         — application
 */
import './consoleGuard.js'
import './safeLogger.js'
import './index.js'
