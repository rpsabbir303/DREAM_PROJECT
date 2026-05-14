import type { AiProviderSettings, AiRoutingDecision, ChatMessage } from '../../shared/interfaces/ipc.js'
import { completeOllamaChat, listOllamaModels } from './providers/ollamaProvider.js'
import { canUseConfiguredGemini, resolveGeminiModel } from './geminiEnv.js'
import { canUseConfiguredOpenAi } from './openAiEnv.js'

function canUseOpenAi() {
  return canUseConfiguredOpenAi()
}

export async function getProviderStatus() {
  const models = await listOllamaModels()
  return {
    online: canUseConfiguredOpenAi() || canUseConfiguredGemini(),
    ollamaReachable: models.length > 0,
    geminiConfigured: canUseConfiguredGemini(),
  }
}

export async function getProviderModels(settings: AiProviderSettings) {
  const localModels = await listOllamaModels()
  const builtIns = ['llama3', 'mistral', 'phi', 'deepseek-r1:8b']
  const local = Array.from(new Set([...builtIns, settings.localModel, ...localModels])).map((name) => ({
    name,
    provider: 'ollama' as const,
    available: localModels.includes(name) || builtIns.includes(name),
  }))
  const cloud = [
    { name: settings.cloudModel, provider: 'openai' as const, available: canUseOpenAi() },
    { name: resolveGeminiModel(), provider: 'gemini' as const, available: canUseConfiguredGemini() },
  ]
  return [...local, ...cloud]
}

export function routeProvider(input: string, settings: AiProviderSettings, hasOllama: boolean): AiRoutingDecision {
  if (settings.offlineMode) {
    return {
      provider: 'ollama',
      model: settings.localModel,
      reason: 'Offline mode is enabled.',
      isOffline: true,
    }
  }
  /** When GEMINI_API_KEY is set, prefer Gemini for chat (avoids OpenAI quota during dev). */
  if (canUseConfiguredGemini()) {
    return {
      provider: 'gemini',
      model: resolveGeminiModel(),
      reason: 'GEMINI_API_KEY is configured — using Google Gemini.',
      isOffline: false,
    }
  }
  /** Cloud path enables OpenAI tool calling (desktop actions decided by the model). */
  if (settings.preferredProvider === 'openai' && canUseOpenAi()) {
    return {
      provider: 'openai',
      model: settings.cloudModel,
      reason: 'User prefers the cloud model (tool-capable path).',
      isOffline: false,
    }
  }
  /** If the API key is configured but Ollama is not running, use cloud instead of a dead local backend. */
  if (canUseOpenAi() && !hasOllama) {
    return {
      provider: 'openai',
      model: settings.cloudModel,
      reason: 'OpenAI configured; local Ollama not reachable.',
      isOffline: false,
    }
  }
  const prefersLocal = settings.preferredProvider === 'ollama'
  const advancedPrompt = input.length > settings.reasoningThreshold || /(plan|analyze|reason|architecture|multi-step)/i.test(input)
  if (!advancedPrompt && prefersLocal && hasOllama) {
    return {
      provider: 'ollama',
      model: settings.localModel,
      reason: 'Low complexity request routed to local model.',
      isOffline: false,
    }
  }
  if (advancedPrompt && canUseOpenAi()) {
    return {
      provider: 'openai',
      model: settings.cloudModel,
      reason: 'Advanced reasoning request routed to cloud model.',
      isOffline: false,
    }
  }
  return {
    provider: 'ollama',
    model: settings.localModel,
    reason: 'OpenAI unavailable or local-first fallback.',
    isOffline: !canUseOpenAi(),
  }
}

/** Basic MVP: one non-streaming completion; emits a single `onDelta` with full text. */
export async function streamWithProvider(params: {
  decision: AiRoutingDecision
  messages: ChatMessage[]
  signal?: AbortSignal
  onDelta: (chunk: string) => void
}) {
  if (params.decision.provider === 'ollama') {
    const text = await completeOllamaChat({
      messages: params.messages,
      model: params.decision.model,
      signal: params.signal,
    })
    params.onDelta(text)
    return text
  }
  throw new Error('streamWithProvider: OpenAI and Gemini use dedicated chat paths in ChatEngine.')
}
