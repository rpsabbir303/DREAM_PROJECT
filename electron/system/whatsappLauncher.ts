/**
 * WhatsApp launch — resolves the real Store/UWP package on this PC.
 * A wrong hard-coded AppsFolder ID makes explorer.exe open Documents instead of WhatsApp.
 */

import { safeLogger } from '../main/safeLogger.js'
import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, readdirSync } from 'node:fs'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

const execAsync = promisify(exec)

const FALLBACK_FAMILY = '5319275A.WhatsAppDesktop_cv1g1gvanyjgm'

async function runPs(script: string, timeoutMs = 12_000): Promise<string> {
  const tmpFile = join(tmpdir(), `jarvis_wa_${randomUUID()}.ps1`)
  try {
    await writeFile(tmpFile, '\uFEFF' + script, 'utf-8')
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 },
    )
    return stdout.trim()
  } finally {
    unlink(tmpFile).catch(() => undefined)
  }
}

/** Installed WhatsApp AppX package family (per-machine). */
export async function resolveWhatsAppPackageFamily(): Promise<string | null> {
  try {
    const out = await runPs(
      `Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*WhatsApp*' -or $_.PackageFamilyName -like '*WhatsApp*' } | Select-Object -First 1 -ExpandProperty PackageFamilyName`,
    )
    const family = out.split('\n')[0]?.trim()
    if (family && family.includes('WhatsApp')) {
      safeLogger.info(`[JARVIS_WA] AppX family=${family}`)
      return family
    }
  } catch (e) {
    safeLogger.warn(`[JARVIS_WA] AppX lookup failed: ${e instanceof Error ? e.message : String(e)}`)
  }
  return null
}

async function launchViaShellAppsFolder(family: string): Promise<boolean> {
  const uri = `shell:AppsFolder\\${family}!App`
  safeLogger.info(`[JARVIS_WA] shell URI → ${uri}`)
  try {
    await runPs(`
$pkg = Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { $_.PackageFamilyName -eq '${family.replace(/'/g, "''")}' } | Select-Object -First 1
if (-not $pkg) { exit 1 }
Start-Process explorer.exe -ArgumentList '${uri.replace(/'/g, "''")}'
exit 0
`)
    return true
  } catch (e) {
    safeLogger.warn(`[JARVIS_WA] AppsFolder launch failed: ${e instanceof Error ? e.message : String(e)}`)
  }
  return false
}

async function launchViaProtocol(): Promise<boolean> {
  for (const proto of ['whatsapp:', 'ms-whatsapp:']) {
    try {
      await execAsync(`cmd /c start "" "${proto}"`, { windowsHide: true, timeout: 10_000 })
      safeLogger.info(`[JARVIS_WA] protocol → ${proto}`)
      return true
    } catch { /* try next */ }
  }
  return false
}

function findWhatsAppExeOnDisk(): string | null {
  const localAppData = process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? '', 'AppData', 'Local')
  const candidates = [
    join(localAppData, 'WhatsApp', 'WhatsApp.exe'),
    join(localAppData, 'Programs', 'WhatsApp', 'WhatsApp.exe'),
  ]

  const packagesDir = join(localAppData, 'Packages')
  if (existsSync(packagesDir)) {
    try {
      for (const dir of readdirSync(packagesDir)) {
        if (!dir.toLowerCase().includes('whatsapp')) continue
        const root = join(packagesDir, dir)
        const search = (folder: string, depth: number): string | null => {
          if (depth > 6) return null
          try {
            for (const entry of readdirSync(folder, { withFileTypes: true })) {
              const full = join(folder, entry.name)
              if (entry.isFile() && /^whatsapp(\.root)?\.exe$/i.test(entry.name)) return full
              if (entry.isDirectory()) {
                const hit = search(full, depth + 1)
                if (hit) return hit
              }
            }
          } catch { /* skip */ }
          return null
        }
        const hit = search(root, 0)
        if (hit) candidates.push(hit)
      }
    } catch { /* skip */ }
  }

  for (const p of candidates) {
    if (existsSync(p)) {
      safeLogger.info(`[JARVIS_WA] exe found → ${p}`)
      return p
    }
  }
  return null
}

function spawnExe(exePath: string): void {
  spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref()
}

/** Launch WhatsApp using every safe strategy until one succeeds. */
export async function launchWhatsApp(): Promise<{ ok: boolean; message: string }> {
  const family = (await resolveWhatsAppPackageFamily()) ?? FALLBACK_FAMILY

  if (await launchViaShellAppsFolder(family)) {
    return { ok: true, message: 'Opening WhatsApp.' }
  }

  if (family !== FALLBACK_FAMILY && (await launchViaShellAppsFolder(FALLBACK_FAMILY))) {
    return { ok: true, message: 'Opening WhatsApp.' }
  }

  if (await launchViaProtocol()) {
    return { ok: true, message: 'Opening WhatsApp.' }
  }

  const exe = findWhatsAppExeOnDisk()
  if (exe) {
    spawnExe(exe)
    return { ok: true, message: 'Opening WhatsApp.' }
  }

  try {
    await execAsync('cmd /c start "" "WhatsApp"', { windowsHide: true, timeout: 10_000 })
    return { ok: true, message: 'Opening WhatsApp.' }
  } catch { /* fall through */ }

  return {
    ok: false,
    message:
      'I could not open WhatsApp. Install WhatsApp from the Microsoft Store, or open it once manually so Windows registers the app.',
  }
}
