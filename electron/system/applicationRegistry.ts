import os from 'node:os'

interface AppTarget {
  win32: string
  darwin: string
  linux: string
}

const APP_REGISTRY: Record<string, AppTarget> = {
  'vs code': { win32: 'code', darwin: 'code', linux: 'code' },
  vscode: { win32: 'code', darwin: 'code', linux: 'code' },
  chrome: { win32: 'chrome', darwin: 'google chrome', linux: 'google-chrome' },
  figma: { win32: 'figma', darwin: 'figma', linux: 'figma' },
  discord: { win32: 'discord', darwin: 'discord', linux: 'discord' },
  terminal: { win32: 'wt', darwin: 'terminal', linux: 'x-terminal-emulator' },
}

export function resolveApplicationCommand(input: string) {
  const key = input.trim().toLowerCase()
  const target = APP_REGISTRY[key]
  if (!target) return null
  const platform = os.platform()
  if (platform !== 'win32' && platform !== 'darwin' && platform !== 'linux') return null
  return target[platform]
}
