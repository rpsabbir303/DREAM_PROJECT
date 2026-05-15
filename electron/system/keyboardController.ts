/**
 * Keyboard Controller
 *
 * Simulates keyboard input via PowerShell System.Windows.Forms.SendKeys.
 *
 * Critical fix: Before sending keys, we switch focus to the previously active
 * window (from runtimeState.session.previousWindow). Without this, all keys
 * would land in the JARVIS chat window itself.
 *
 * Architecture:
 *   User command → nlpRouter → keyboard.shortcut / keyboard.type
 *     → keyboardController → focus previousWindow → PS SendKeys → desktop action
 */

import { safeLogger } from '../main/safeLogger.js'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface KeyResult {
  ok:      boolean
  message: string
}

// ─── SendKeys key map ─────────────────────────────────────────────────────────
//
// Reference: https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.sendkeys
// Special keys must be wrapped in {KEYNAME}.
// Modifier keys: + = Shift, ^ = Ctrl, % = Alt

const SPECIAL_KEY_MAP: Record<string, string> = {
  enter:       '{ENTER}',
  return:      '{ENTER}',
  escape:      '{ESC}',
  esc:         '{ESC}',
  tab:         '{TAB}',
  backspace:   '{BACKSPACE}',
  back:        '{BACKSPACE}',
  delete:      '{DELETE}',
  del:         '{DEL}',
  space:       ' ',
  up:          '{UP}',
  down:        '{DOWN}',
  left:        '{LEFT}',
  right:       '{RIGHT}',
  home:        '{HOME}',
  end:         '{END}',
  pgup:        '{PGUP}',
  pageup:      '{PGUP}',
  pgdn:        '{PGDN}',
  pagedown:    '{PGDN}',
  insert:      '{INSERT}',
  ins:         '{INSERT}',
  f1:          '{F1}',  f2:  '{F2}',  f3:  '{F3}',  f4:  '{F4}',
  f5:          '{F5}',  f6:  '{F6}',  f7:  '{F7}',  f8:  '{F8}',
  f9:          '{F9}',  f10: '{F10}', f11: '{F11}', f12: '{F12}',
  prtsc:       '{PRTSC}',
  printscreen: '{PRTSC}',
}

const MODIFIER_MAP: Record<string, string> = {
  ctrl:    '^',
  control: '^',
  alt:     '%',
  shift:   '+',
}

const SHORTCUT_ALIASES: Record<string, string> = {
  'ctrl+s':       '^s',
  'ctrl+c':       '^c',
  'ctrl+v':       '^v',
  'ctrl+x':       '^x',
  'ctrl+z':       '^z',
  'ctrl+y':       '^y',
  'ctrl+a':       '^a',
  'ctrl+f':       '^f',
  'ctrl+p':       '^p',
  'ctrl+n':       '^n',
  'ctrl+t':       '^t',
  'ctrl+w':       '^w',
  'ctrl+r':       '^r',
  'ctrl+l':       '^l',
  'ctrl+d':       '^d',
  'ctrl+shift+s': '^+s',
  'ctrl+shift+t': '^+t',
  'ctrl+shift+p': '^+p',
  'ctrl+shift+n': '^+n',
  'ctrl+shift+i': '^+i',
  'alt+tab':      '%{TAB}',
  'alt+f4':       '%{F4}',
  'alt+enter':    '%{ENTER}',
  'save':         '^s',
  'copy':         '^c',
  'paste':        '^v',
  'cut':          '^x',
  'undo':         '^z',
  'redo':         '^y',
  'select all':   '^a',
  'find':         '^f',
  'print':        '^p',
  'new tab':      '^t',
  'close tab':    '^w',
  'reopen tab':   '^+t',
  'refresh':      '{F5}',
  'reload':       '{F5}',
  'fullscreen':   '{F11}',
  'go back':      '%{LEFT}',
  'go forward':   '%{RIGHT}',
}

// ─── Key sequence builder ─────────────────────────────────────────────────────

export function buildSendKeysSequence(keyExpr: string): string {
  const lower = keyExpr.trim().toLowerCase()

  const alias = SHORTCUT_ALIASES[lower]
  if (alias) return alias

  const specialKey = SPECIAL_KEY_MAP[lower]
  if (specialKey) return specialKey

  // Modifier+key combos: split by +
  const parts = lower.split('+').map((p) => p.trim())
  if (parts.length > 1) {
    let prefix  = ''
    let keyPart = ''
    for (const part of parts) {
      const mod = MODIFIER_MAP[part]
      if (mod) {
        prefix += mod
      } else {
        const special = SPECIAL_KEY_MAP[part]
        keyPart = special ?? (part.length === 1 ? part : `{${part.toUpperCase()}}`)
      }
    }
    if (prefix && keyPart) return `${prefix}${keyPart}`
  }

  // Plain character — escape SendKeys special chars
  return lower.replace(/[+^%~(){}[\]]/g, (c) => `{${c}}`)
}

// ─── Focus the previous window so keys go to the right app ──────────────────
//
// When the user sends a keyboard command in JARVIS, the JARVIS window has
// focus. We use the runtimeState.session.previousWindow.pid to find and
// focus the window the user was in BEFORE switching to JARVIS.

async function focusPreviousWindow(): Promise<{ hwnd: number; title: string } | null> {
  let prevPid: number | null = null
  let prevTitle = ''

  try {
    // runtimeState is in the same Node process (Electron main)
    const { runtimeState } = await import('./runtimeState.js')
    const prev = runtimeState.session.previousWindow
    if (prev) {
      prevPid   = prev.pid
      prevTitle = prev.title
      safeLogger.info(`[JARVIS_KB] previous window pid=${prevPid} title="${prevTitle}"`)
    }
  } catch {
    // non-fatal
  }

  if (!prevPid) {
    // No prior window known — use Alt+Tab approach via SendKeys itself
    safeLogger.info(`[JARVIS_KB] no previous window — using Alt+Tab to switch focus`)
    return null
  }

  // Find and focus the window of prevPid via PS SetForegroundWindow
  const ps = `
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class JarvisKF {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
}
'@ -ErrorAction SilentlyContinue
$p = Get-Process -Id ${prevPid} -ErrorAction SilentlyContinue
if ($p -and $p.MainWindowHandle -ne 0) {
    $h = $p.MainWindowHandle
    if ([JarvisKF]::IsIconic($h)) { [JarvisKF]::ShowWindow($h, 9) | Out-Null }
    [JarvisKF]::SetForegroundWindow($h) | Out-Null
    Write-Output "focused:$($h.ToInt64())"
} else { Write-Output 'not_found' }
  `.trim().replace(/\n/g, '; ')

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`,
      { windowsHide: true, timeout: 8_000 },
    )
    const line = stdout.trim()
    if (line.startsWith('focused:')) {
      const hwnd = Number(line.split(':')[1])
      safeLogger.info(`[JARVIS_KB] focused prev window hwnd=${hwnd} title="${prevTitle}"`)
      return { hwnd, title: prevTitle }
    }
    safeLogger.info(`[JARVIS_KB] could not focus prev window: ${line}`)
  } catch (e) {
    safeLogger.warn(`[JARVIS_KB] focusPreviousWindow error: ${e instanceof Error ? e.message : e}`)
  }

  return null
}

// ─── PowerShell SendKeys executor ────────────────────────────────────────────

async function sendKeysPs(sequence: string): Promise<void> {
  const safe = sequence.replace(/'/g, "''")
  const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${safe}')`
  await execAsync(
    `powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`,
    { windowsHide: true, timeout: 10_000 },
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Press a key or shortcut.
 * Automatically focuses the previous (non-JARVIS) window first.
 *
 * @param keyExpr  e.g. "ctrl+s", "alt+f4", "enter", "f5"
 */
export async function pressKey(keyExpr: string): Promise<KeyResult> {
  const seq = buildSendKeysSequence(keyExpr)
  safeLogger.info(`[JARVIS_KB] pressKey: "${keyExpr}" → seq="${seq}"`)

  // Focus the previous window so keys go to the right app
  const focused = await focusPreviousWindow()
  if (!focused) {
    // Fallback: brief delay and hope user has focus elsewhere
    // (for alt+tab this is actually correct — no pre-focus needed)
    await new Promise((r) => setTimeout(r, 300))
  } else {
    // Small settle time after SetForegroundWindow
    await new Promise((r) => setTimeout(r, 150))
  }

  try {
    await sendKeysPs(seq)
    const targetLabel = focused ? `"${focused.title}"` : 'foreground window'
    safeLogger.info(`[JARVIS_KB] ✓ sent "${seq}" to ${targetLabel}`)
    return { ok: true, message: `Pressed ${keyExpr}.` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    safeLogger.error(`[JARVIS_KB] ✗ pressKey failed: ${msg.slice(0, 200)}`)
    return { ok: false, message: `Could not send keys: ${msg.slice(0, 120)}` }
  }
}

/**
 * Type text into the previously active window.
 */
export async function typeText(text: string): Promise<KeyResult> {
  safeLogger.info(`[JARVIS_KB] typeText: "${text.slice(0, 80)}"`)

  const focused = await focusPreviousWindow()
  if (!focused) {
    await new Promise((r) => setTimeout(r, 300))
  } else {
    await new Promise((r) => setTimeout(r, 150))
  }

  // Escape special SendKeys chars in text
  const escaped = text.replace(/[+^%~(){}[\]]/g, (c) => `{${c}}`)
  try {
    await sendKeysPs(escaped)
    const targetLabel = focused ? `"${focused.title}"` : 'foreground window'
    safeLogger.info(`[JARVIS_KB] ✓ typed ${text.length} chars to ${targetLabel}`)
    return {
      ok:      true,
      message: `Typed: ${text.length > 40 ? text.slice(0, 37) + '…' : text}`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Could not type text: ${msg.slice(0, 120)}` }
  }
}

export async function executeShortcut(shortcutName: string): Promise<KeyResult> {
  return pressKey(shortcutName)
}
