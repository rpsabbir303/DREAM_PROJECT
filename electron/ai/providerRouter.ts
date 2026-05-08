import type { AiProviderSettings, AiRoutingDecision, ChatMessage } from '../../shared/interfaces/ipc.js'
import { listOllamaModels, streamOllamaResponse } from './providers/ollamaProvider.js'
import { streamOpenAiResponse } from './providers/openAiProvider.js'

function readEnv(name: string) {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : null
}

function canUseOpenAi() {
  return Boolean(readEnv('OPENAI_API_KEY'))
}

export async function getProviderStatus() {
  const models = await listOllamaModels()
  return {
    online: canUseOpenAi(),
    ollamaReachable: models.length > 0,
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
  const cloud = [{ name: settings.cloudModel, provider: 'openai' as const, available: canUseOpenAi() }]
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

export async function streamWithProvider(params: {
  decision: AiRoutingDecision
  messages: ChatMessage[]
  signal?: AbortSignal
  onDelta: (chunk: string) => void
}) {
  if (params.decision.provider === 'ollama') {
    return streamOllamaResponse({
      messages: params.messages,
      model: params.decision.model,
      signal: params.signal,
      onDelta: params.onDelta,
    })
  }
  return streamOpenAiResponse({
    messages: params.messages,
    model: params.decision.model,
    signal: params.signal,
    onDelta: params.onDelta,
  })
}
