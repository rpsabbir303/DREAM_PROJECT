import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { canUseConfiguredGemini } from '../ai/geminiEnv.js'
import { canUseConfiguredOpenAi, readProcessEnv } from '../ai/openAiEnv.js'

/**
 * Read at call time (not at module load) so parent `cross-env` and dotenv both apply
 * before the first BrowserWindow loads.
 */
export function getDevServerUrl(): string | undefined {
  const raw = process.env.VITE_DEV_SERVER_URL
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function isDesktopViteDev(): boolean {
  return getDevServerUrl() !== undefined
}

let envLoaded = false

/**
 * Loads `.env` into `process.env` for the Electron main process.
 * Vite only injects env for the renderer; OpenAI/Whisper read keys here.
 */
export function loadDesktopEnvironment(): void {
  if (envLoaded) return
  envLoaded = true

  const mainDir = path.dirname(fileURLToPath(import.meta.url))
  const treeEnvPath = path.resolve(mainDir, '../../..', '.env')
  const cwdEnvPath = path.resolve(process.cwd(), '.env')

  console.info('[JARVIS_ENV] cwd=', process.cwd())
  console.info('[JARVIS_ENV] candidate .env (from app tree)=', treeEnvPath)
  console.info('[JARVIS_ENV] candidate .env (from cwd)=', cwdEnvPath)

  const fromTree = config({ path: treeEnvPath })
  if (fromTree.parsed) {
    console.info(
      '[JARVIS_ENV] loaded tree .env →',
      Object.keys(fromTree.parsed).length,
      'var(s):',
      Object.keys(fromTree.parsed).join(', '),
    )
  } else if (fromTree.error && 'code' in fromTree.error && fromTree.error.code !== 'ENOENT') {
    console.warn('[JARVIS_ENV] tree .env:', fromTree.error.message)
  } else {
    console.info('[JARVIS_ENV] tree .env not found (ok if you use OS env vars)')
  }

  const fromCwd = config({ path: cwdEnvPath, override: true })
  if (fromCwd.parsed) {
    console.info('[JARVIS_ENV] cwd .env applied (overrides) →', Object.keys(fromCwd.parsed).length, 'var(s)')
  }

  console.info(
    '[JARVIS_ENV] VITE_DEV_SERVER_URL after dotenv=',
    process.env.VITE_DEV_SERVER_URL?.trim() ? process.env.VITE_DEV_SERVER_URL : '(unset)',
  )

  const rawKey = readProcessEnv('OPENAI_API_KEY')
  const model = readProcessEnv('OPENAI_MODEL')
  const usable = canUseConfiguredOpenAi()
  console.info('[JARVIS_ENV] OPENAI_API_KEY configured=', Boolean(rawKey), 'usable_for_OpenAI=', usable)
  if (rawKey && !usable) {
    console.warn(
      '[JARVIS_ENV] OPENAI_API_KEY is set but ignored for OpenAI routing — use a real `sk-…` secret from https://platform.openai.com/api-keys (not template text).',
    )
  }
  if (model) {
    console.info('[JARVIS_ENV] OPENAI_MODEL=', model)
  } else {
    console.info('[JARVIS_ENV] OPENAI_MODEL (unset, default gpt-4o-mini)')
  }
  if (usable && rawKey) {
    console.info('[JARVIS_ENV] OPENAI_API_KEY loaded: true (suffix …' + rawKey.slice(-4) + ')')
  } else if (!rawKey) {
    console.warn('[JARVIS_ENV] OPENAI_API_KEY is not set — cloud chat and Whisper will fail until `.env` has a key.')
  }

  const geminiKey = readProcessEnv('GEMINI_API_KEY')
  const geminiUsable = canUseConfiguredGemini()
  console.info('[JARVIS_ENV] GEMINI_API_KEY configured=', Boolean(geminiKey), 'usable_for_Gemini=', geminiUsable)
  if (geminiKey && !geminiUsable) {
    console.warn('[JARVIS_ENV] GEMINI_API_KEY is set but ignored — replace placeholder with a key from Google AI Studio.')
  }
  if (readProcessEnv('GEMINI_MODEL')) {
    console.info('[JARVIS_ENV] GEMINI_MODEL=', readProcessEnv('GEMINI_MODEL'))
  } else {
    console.info('[JARVIS_ENV] GEMINI_MODEL (unset, default gemini-2.0-flash)')
  }
}

if (process.versions.electron) {
  loadDesktopEnvironment()
}
