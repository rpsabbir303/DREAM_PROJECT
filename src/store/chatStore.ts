import { create } from 'zustand'
import type {
  AiRoutingDecision,
  AssistantTask,
  ChatMessage,
  ChatStreamEvent,
  CommandUnderstanding,
} from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'
import { usePersonalizationStore } from '@/store/personalizationStore'

interface ChatStore {
  messages: ChatMessage[]
  tasks: AssistantTask[]
  latestUnderstanding: CommandUnderstanding | null
  providerDecision: AiRoutingDecision | null
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

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  tasks: [],
  latestUnderstanding: null,
  providerDecision: null,
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

    set((state) => ({
      messages: [...state.messages, userMessage, assistantPlaceholder],
      inputValue: '',
      activeStreamId: streamId,
      isThinking: true,
      isStreaming: false,
      error: null,
    }))

    await desktopClient.startChatStream({
      streamId,
      input: content,
      history: get().messages,
    })
  },
}))

function handleStreamEvent(
  event: ChatStreamEvent,
  set: (partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)) => void,
) {
  if (event.type === 'start') {
    set({ isThinking: true, isStreaming: false, error: null })
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
    if (!event.data.ok) set({ error: event.data.message })
    return
  }

  if (event.type === 'delta') {
    set((state) => {
      const messages = [...state.messages]
      const lastAssistantIndex = [...messages].reverse().findIndex((message) => message.role === 'assistant')
      if (lastAssistantIndex === -1) return { isStreaming: true, isThinking: false }
      const index = messages.length - 1 - lastAssistantIndex
      messages[index] = {
        ...messages[index],
        content: `${messages[index].content}${event.data.chunk}`,
      }
      return { messages, isStreaming: true, isThinking: false }
    })
    return
  }

  if (event.type === 'complete') {
    set({ isThinking: false, isStreaming: false, activeStreamId: null })
    return
  }

  if (event.type === 'error') {
    set({ error: event.data.message, isThinking: false, isStreaming: false, activeStreamId: null })
  }
}
