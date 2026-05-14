import fs from 'node:fs'
import path from 'node:path'
import { shell } from 'electron'
import type { ExecutionResult } from '../../shared/interfaces/ipc.js'
import { expandUserPathAlias } from './userPathAliases.js'

export async function openPathTarget(target: string): Promise<ExecutionResult> {
  const expanded = expandUserPathAlias(target)
  const resolved = path.resolve(expanded)
  if (!fs.existsSync(resolved)) {
    return {
      ok: false,
      actionType: 'open_path',
      message: `Path not found: ${resolved}`,
      error: 'path_not_found',
    }
  }

  const result = await shell.openPath(resolved)
  if (result) {
    return {
      ok: false,
      actionType: 'open_path',
      message: `Could not open path: ${resolved}`,
      error: result,
    }
  }

  return {
    ok: true,
    actionType: 'open_path',
    message: `Opened path: ${resolved}`,
  }
}

export async function openUrlTarget(target: string): Promise<ExecutionResult> {
  const trimmed = target.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      ok: false,
      actionType: 'open_url',
      message: `Blocked URL (only http/https): ${trimmed}`,
      error: 'invalid_url',
    }
  }

  await shell.openExternal(trimmed)
  return {
    ok: true,
    actionType: 'open_url',
    message: `Opened URL: ${trimmed}`,
  }
}
