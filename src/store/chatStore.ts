import { create } from 'zustand'
import type {
  AiRoutingDecision,
  AssistantTask,
  ChatMessage,
  ChatStreamEvent,
  CommandUnderstanding,
  ExecutionResult,
} from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'
import { usePersonalizationStore } from '@/store/personalizationStore'

const MAX_CHAT_MESSAGES = 100

/** Batches token deltas to one Zustand update per animation frame (smoother UI, less GC). */
let pendingDeltaText = ''
let deltaFlushRaf: number | null = null

function cancelDeltaFlush() {
  if (deltaFlushRaf !== null) {
    cancelAnimationFrame(deltaFlushRaf)
    deltaFlushRaf = null
  }
}

function resetDeltaBuffer() {
  cancelDeltaFlush()
  pendingDeltaText = ''
}

function appendToLastAssistant(messages: ChatMessage[], chunk: string): ChatMessage[] {
  const next = [...messages]
  const lastAssistantIndex = [...next].reverse().findIndex((m) => m.role === 'assistant')
  if (lastAssistantIndex === -1) return next
  const index = next.length - 1 - lastAssistantIndex
  next[index] = {
    ...next[index],
    content: `${next[index].content}${chunk}`,
  }
  return next
}

function scheduleDeltaFlush(
  set: (partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)) => void,
) {
  if (deltaFlushRaf !== null) return
  deltaFlushRaf = requestAnimationFrame(() => {
    deltaFlushRaf = null
    const batch = pendingDeltaText
    pendingDeltaText = ''
    if (!batch) return
    set((state) => ({
      messages: appendToLastAssistant(state.messages, batch),
      isStreaming: true,
      isThinking: false,
    }))
  })
}

/** Applies any queued deltas synchronously (before complete / error / new stream). */
function flushPendingDeltasSync(
  set: (partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)) => void,
) {
  cancelDeltaFlush()
  const batch = pendingDeltaText
  pendingDeltaText = ''
  if (!batch) return
  set((state) => ({
    messages: appendToLastAssistant(state.messages, batch),
    isStreaming: true,
    isThinking: false,
  }))
}

interface ToolStep {
  name: string
  summary: string
  ok: boolean
}

export interface AutomationDebugInfo {
  /** Raw user input */
  input: string
  /** Intent type resolved by NLP router */
  intentType: string
  /** Parsed params (app, key, text, etc.) */
  intentParams: Record<string, unknown>
  /** Whether execution succeeded */
  ok: boolean
  /** What the execution layer returned */
  message: string
  /** Raw output string from execution layer */
  output?: string
  /** Timestamp */
  at: string
}

interface ChatStore {
  messages: ChatMessage[]
  tasks: AssistantTask[]
  latestUnderstanding: CommandUnderstanding | null
  providerDecision: AiRoutingDecision | null
  /** Last model tool invocations for this stream (OpenAI tools path). */
  recentToolSteps: ToolStep[]
  /** Last desktop execution result (for compact feedback under the transcript). */
  lastExecution: ExecutionResult | null
  /** Debug info populated from the execution event — shown in DebugPanel. */
  lastDebugInfo: AutomationDebugInfo | null
  inputValue: string
  isStreaming: boolean
  isThinking: boolean
  error: string | null
  activeStreamId: string | null
  initialized: boolean
  setInputValue: (value: string) => void
  initializeStreamListener: () => void
  sendMessage: (input: string) => Promise<void>
}

function nowIso() {
  return new Date().toISOString()
}

/** User-safe error text — never expose API keys or stack traces in the UI. */
function sanitizeChatError(raw: string): string {
  if (/GEMINI_API_KEY|api\s*key|aistudio|google ai studio|generativeai/i.test(raw)) {
    return 'AI provider unavailable'
  }
  if (/\n\s*at\s+|\bstack\b|\.ts:\d+|\.js:\d+/i.test(raw)) {
    return 'Something went wrong'
  }
  if (raw.length > 120) {
    return 'Something went wrong'
  }
  return raw
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  tasks: [],
  latestUnderstanding: null,
  providerDecision: null,
  recentToolSteps: [],
  lastExecution: null,
  lastDebugInfo: null,
  inputValue: '',
  isStreaming: false,
  isThinking: false,
  error: null,
  activeStreamId: null,
  initialized: false,
  setInputValue: (inputValue) => set({ inputValue }),
  initializeStreamListener: () => {
    if (get().initialized) return

    desktopClient.onChatStreamEvent((event) => {
      const state = get()
      if (state.activeStreamId && event.streamId !== state.activeStreamId) return

      handleStreamEvent(event, set)
    })
    void usePersonalizationStore.getState().loadSuggestions()
    set({ initialized: true })
  },
  sendMessage: async (input) => {
    const content = input.trim()
    if (!content) return

    if (get().isThinking || get().isStreaming) {
      console.warn('[JARVIS_UI] sendMessage ignored — turn already in progress')
      return
    }

    const priorMessages = get().messages
    const streamId = crypto.randomUUID()
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: nowIso(),
    }
    const assistantPlaceholder: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: nowIso(),
    }

    resetDeltaBuffer()

    set({
      messages: [...priorMessages, userMessage, assistantPlaceholder],
      inputValue: '',
      activeStreamId: streamId,
      isThinking: true,
      isStreaming: false,
      error: null,
      recentToolSteps: [],
    })

    try {
      console.info('[JARVIS_UI] sendMessage → startChatStream', streamId)
      const accepted = await desktopClient.startChatStream({
        streamId,
        input: content,
        history: priorMessages.slice(-24),
      })
      if (accepted == null) {
        throw new Error(
          'Desktop bridge unavailable — preload did not expose window.jarvis (see terminal [JARVIS_PRELOAD] / [JARVIS_ELECTRON]). Use `npm run dev` in Electron, not a browser tab.',
        )
      }
      console.info('[JARVIS_UI] startChatStream accepted; awaiting stream events', streamId)
    } catch (error) {
      const message = sanitizeChatError(error instanceof Error ? error.message : 'Chat request failed.')
      resetDeltaBuffer()
      set((state) => {
        const messages = [...state.messages]
        const last = messages[messages.length - 1]
        if (last?.role === 'assistant' && !last.content.trim()) {
          messages.pop()
        }
        return {
          messages,
          isThinking: false,
          isStreaming: false,
          activeStreamId: null,
          error: message,
        }
      })
    }
  },
}))

function handleStreamEvent(
  event: ChatStreamEvent,
  set: (partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)) => void,
) {
  if (event.type === 'start') {
    resetDeltaBuffer()
    set({ isThinking: true, isStreaming: false, error: null, recentToolSteps: [], lastExecution: null })
    return
  }

  if (event.type === 'intent') {
    set({ latestUnderstanding: event.data })
    return
  }

  if (event.type === 'provider') {
    set({ providerDecision: event.data })
    return
  }

  if (event.type === 'task') {
    set((state) => ({ tasks: [event.data, ...state.tasks] }))
    return
  }

  if (event.type === 'task-status') {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === event.data.taskId ? { ...task, status: event.data.status } : task,
      ),
    }))
    return
  }

  if (event.type === 'execution') {
    // Parse debug metadata from the output field (formatted by chatEngine)
    const outputParts: Record<string, unknown> = {}
    const rawOutput = event.data.output ?? ''
    for (const part of rawOutput.split(' ')) {
      const [k, v] = part.split('=')
      if (k && v !== undefined) outputParts[k] = v
    }
    set({
      lastExecution: event.data,
      lastDebugInfo: {
        input:        (outputParts['input'] as string) ?? '',
        intentType:   (outputParts['intent'] as string) ?? '—',
        intentParams: { app: outputParts['app'] ?? '—' },
        ok:           event.data.ok,
        message:      event.data.message,
        output:       rawOutput,
        at:           new Date().toISOString(),
      },
      error: event.data.ok ? null : event.data.message,
    })
    return
  }

  if (event.type === 'tool-use') {
    set((state) => ({
      recentToolSteps: [
        { name: event.data.name, summary: event.data.summary, ok: event.data.ok },
        ...state.recentToolSteps,
      ].slice(0, 8),
    }))
    return
  }

  if (event.type === 'delta') {
    pendingDeltaText += event.data.chunk
    scheduleDeltaFlush(set)
    return
  }

  if (event.type === 'complete') {
    flushPendingDeltasSync(set)
    const finalText = event.data.finalText?.trim() ?? ''
    console.info('[JARVIS_UI] stream complete', event.streamId, 'finalLen=', finalText.length)
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]
      if (last?.role === 'assistant' && !last.content.trim() && finalText) {
        messages[messages.length - 1] = { ...last, content: finalText }
      }
      return {
        isThinking: false,
        isStreaming: false,
        activeStreamId: null,
        messages:
          messages.length > MAX_CHAT_MESSAGES ? messages.slice(-MAX_CHAT_MESSAGES) : messages,
      }
    })
    return
  }

  if (event.type === 'error') {
    flushPendingDeltasSync(set)
    const msg = sanitizeChatError(event.data.message)
    console.error('[JARVIS_UI] stream error', event.streamId, event.data.message)
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]
      if (last?.role === 'assistant' && !last.content.trim()) {
        messages.pop()
      }
      return {
        messages,
        error: msg,
        isThinking: false,
        isStreaming: false,
        activeStreamId: null,
      }
    })
  }
}
