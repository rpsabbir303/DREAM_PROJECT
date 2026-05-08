import activeWin from 'active-win'
import type { ActiveWindowInfo } from '../../shared/interfaces/ipc.js'

export async function getActiveWindowInfo(): Promise<ActiveWindowInfo | null> {
  const info = await activeWin().catch(() => null)
  if (!info) return null
  return {
    app: info.owner.name,
    title: info.title,
    processName: info.owner.path ?? 'unknown-process',
  }
}
