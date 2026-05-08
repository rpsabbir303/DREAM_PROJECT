import fs from 'node:fs'
import path from 'node:path'
import { shell } from 'electron'
import type { ExecutionResult } from '../../shared/interfaces/ipc.js'

export async function openPathTarget(target: string): Promise<ExecutionResult> {
  const resolved = path.resolve(target)
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
  if (!/^https?:\/\//i.test(target)) {
    return {
      ok: false,
      actionType: 'open_url',
      message: `Blocked URL: ${target}`,
      error: 'invalid_url',
    }
  }

  await shell.openExternal(target)
  return {
    ok: true,
    actionType: 'open_url',
    message: `Opened URL: ${target}`,
  }
}
