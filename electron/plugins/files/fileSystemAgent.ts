/**
 * File System Agent — Phase 2
 *
 * Safe file and folder operations:
 *   - Open special folders (Downloads, Desktop, Documents, etc.)
 *   - Create files / folders
 *   - Delete files (risk: high — routed through actionGuard)
 *   - Move / rename
 *   - Search files
 *
 * All paths are validated before execution.
 * Destructive operations are tagged risk:'high' for actionGuard.
 */

import { shell } from 'electron'
import { exec } from 'node:child_process'
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

// ─── Special Folder Aliases ───────────────────────────────────────────────────

const SPECIAL_FOLDERS: Record<string, () => string> = {
  desktop:     () => path.join(os.homedir(), 'Desktop'),
  downloads:   () => path.join(os.homedir(), 'Downloads'),
  documents:   () => path.join(os.homedir(), 'Documents'),
  music:       () => path.join(os.homedir(), 'Music'),
  videos:      () => path.join(os.homedir(), 'Videos'),
  pictures:    () => path.join(os.homedir(), 'Pictures'),
  temp:        () => os.tmpdir(),
  home:        () => os.homedir(),
  appdata:     () => process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'),
  localappdata: () => process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'),
  'onedrive':  () => path.join(os.homedir(), 'OneDrive'),
}

/** All alias keys that map to SPECIAL_FOLDERS */
const FOLDER_ALIASES: Record<string, string> = {
  downloads: 'downloads',
  download:  'downloads',
  desktop:   'desktop',
  documents: 'documents',
  document:  'documents',
  docs:      'documents',
  music:     'music',
  videos:    'videos',
  video:     'videos',
  pictures:  'pictures',
  picture:   'pictures',
  photos:    'pictures',
  images:    'pictures',
  temp:      'temp',
  tmp:       'temp',
  temporary: 'temp',
  home:      'home',
}

export function resolveSpecialFolder(name: string): string | null {
  const key = name.trim().toLowerCase().replace(/\s+folder$/, '').replace(/\s+directory$/, '').trim()
  const mapped = FOLDER_ALIASES[key]
  if (!mapped) return null
  return SPECIAL_FOLDERS[mapped]?.() ?? null
}

// ─── Open Folder ──────────────────────────────────────────────────────────────

export async function openFolder(nameOrPath: string): Promise<{ ok: boolean; message: string }> {
  const special = resolveSpecialFolder(nameOrPath)
  const targetPath = special ?? path.resolve(nameOrPath)

  try {
    await fsp.access(targetPath)
  } catch {
    return { ok: false, message: `Folder not found: "${nameOrPath}".` }
  }

  const err = await shell.openPath(targetPath)
  if (err) return { ok: false, message: `Could not open folder: ${err}` }
  return { ok: true, message: `Opened ${special ? nameOrPath : targetPath}.` }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createFolder(
  name: string,
  parentDir?: string,
): Promise<{ ok: boolean; message: string; path?: string }> {
  const base = parentDir ?? path.join(os.homedir(), 'Desktop')
  const fullPath = path.join(base, name)

  try {
    await fsp.mkdir(fullPath, { recursive: true })
    return { ok: true, message: `Created folder "${name}" at ${base}.`, path: fullPath }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Could not create folder: ${msg.slice(0, 160)}` }
  }
}

export async function createFile(
  name: string,
  parentDir?: string,
  content = '',
): Promise<{ ok: boolean; message: string; path?: string }> {
  const base = parentDir ?? path.join(os.homedir(), 'Desktop')
  const fullPath = path.join(base, name)

  try {
    await fsp.writeFile(fullPath, content, { flag: 'wx' })
    return { ok: true, message: `Created file "${name}" at ${base}.`, path: fullPath }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('EEXIST')) return { ok: false, message: `File "${name}" already exists.` }
    return { ok: false, message: `Could not create file: ${msg.slice(0, 160)}` }
  }
}

// ─── Delete (HIGH RISK — always confirmed by actionGuard) ────────────────────

export async function deleteFile(targetPath: string): Promise<{ ok: boolean; message: string }> {
  const resolved = path.resolve(targetPath)
  try {
    const stat = await fsp.stat(resolved)
    if (stat.isDirectory()) {
      await fsp.rm(resolved, { recursive: true, force: true })
      return { ok: true, message: `Deleted folder "${resolved}".` }
    }
    await fsp.unlink(resolved)
    return { ok: true, message: `Deleted file "${resolved}".` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('ENOENT')) return { ok: false, message: `File not found: "${resolved}".` }
    return { ok: false, message: `Could not delete: ${msg.slice(0, 160)}` }
  }
}

/** Send file to Recycle Bin via PowerShell (safer than permanent delete). */
export async function recycleFile(targetPath: string): Promise<{ ok: boolean; message: string }> {
  const resolved = path.resolve(targetPath)
  try {
    const ps = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${resolved.replace(/'/g, "''")}', 'OnlyErrorDialogs', 'SendToRecycleBin')`
    await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { windowsHide: true, timeout: 10_000 })
    return { ok: true, message: `Moved "${resolved}" to Recycle Bin.` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Could not recycle file: ${msg.slice(0, 160)}` }
  }
}

// ─── Move / Rename ────────────────────────────────────────────────────────────

export async function moveFile(
  src: string,
  dest: string,
): Promise<{ ok: boolean; message: string }> {
  const srcResolved  = path.resolve(src)
  const destResolved = path.resolve(dest)
  try {
    await fsp.rename(srcResolved, destResolved)
    return { ok: true, message: `Moved "${srcResolved}" → "${destResolved}".` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Could not move: ${msg.slice(0, 160)}` }
  }
}

export async function renameFile(
  targetPath: string,
  newName: string,
): Promise<{ ok: boolean; message: string }> {
  const resolved  = path.resolve(targetPath)
  const destPath  = path.join(path.dirname(resolved), newName)
  try {
    await fsp.rename(resolved, destPath)
    return { ok: true, message: `Renamed to "${newName}".` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Could not rename: ${msg.slice(0, 160)}` }
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface FileSearchResult {
  path: string
  name: string
  isDirectory: boolean
}

/**
 * Search for files/folders matching `query` under `searchRoot` (default: home dir).
 * Uses PowerShell Get-ChildItem for fast recursive search.
 */
export async function searchFiles(
  query: string,
  searchRoot?: string,
  maxResults = 20,
): Promise<{ ok: boolean; results: FileSearchResult[]; message: string }> {
  const root = searchRoot ?? os.homedir()
  const safeQuery = query.replace(/['"]/g, '')
  const safeRoot  = root.replace(/'/g, "''")

  try {
    const ps = `
      Get-ChildItem -Path '${safeRoot}' -Recurse -ErrorAction SilentlyContinue -Force |
      Where-Object { $_.Name -like '*${safeQuery}*' } |
      Select-Object -First ${maxResults} |
      Select-Object @{N='path';E={$_.FullName}},@{N='name';E={$_.Name}},@{N='isDir';E={$_.PSIsContainer}} |
      ConvertTo-Json -Compress
    `
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${ps.replace(/\n\s*/g, ' ')}"`,
      { windowsHide: true, timeout: 20_000 },
    )
    const text = stdout.trim()
    if (!text || text === 'null') return { ok: true, results: [], message: `No files found matching "${query}".` }
    const raw = JSON.parse(text)
    const arr = Array.isArray(raw) ? raw : [raw]
    const results: FileSearchResult[] = arr.map((r) => ({
      path: String(r.path),
      name: String(r.name),
      isDirectory: Boolean(r.isDir),
    }))
    return {
      ok: true,
      results,
      message: `Found ${results.length} result${results.length !== 1 ? 's' : ''} for "${query}".`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, results: [], message: `Search failed: ${msg.slice(0, 160)}` }
  }
}

// ─── Recycle Bin ─────────────────────────────────────────────────────────────

export async function emptyRecycleBin(): Promise<{ ok: boolean; message: string }> {
  try {
    await execAsync(
      `powershell -NoProfile -NonInteractive -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"`,
      { windowsHide: true, timeout: 15_000 },
    )
    return { ok: true, message: 'Recycle Bin emptied.' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Could not empty Recycle Bin: ${msg.slice(0, 160)}` }
  }
}
