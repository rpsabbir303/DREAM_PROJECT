import type {
  ActivityLogRecord,
  AssistantOverlayState,
  AiModelInfo,
  AiProviderMetrics,
  AiProviderRuntimeStatus,
  AiProviderSettings,
  AssistantTask,
  ActiveWindowInfo,
  ChatStartStreamInput,
  ChatStreamEvent,
  CommandMemoryStats,
  CommandLogRecord,
  CommandPaletteItem,
  ExecuteIntentResult,
  MemoryOverview,
  ParsedIntent,
  PersonalizationSuggestion,
  ProjectMemory,
  ScreenAnalysisResult,
  ScreenCaptureRecord,
  GlobalShortcutBindings,
  WorkspaceContext,
  WorkflowRunRecord,
  WorkflowSchedule,
  SystemSnapshot,
  VoiceTranscriptionInput,
  VoiceTranscriptionResult,
  WorkflowDefinition,
} from '../interfaces/ipc.js'

/** Preload-exposed API for the MVP desktop assistant (chat, commands, workflows, voice, screen). */
export interface JarvisDesktopApi {
  system: {
    getSnapshot: () => Promise<SystemSnapshot>
  }
  ai: {
    parseIntent: (input: string) => Promise<ParsedIntent>
    executeIntent: (input: string) => Promise<ExecuteIntentResult>
    startChatStream: (input: ChatStartStreamInput) => Promise<{ accepted: true }>
    cancelChatStream: (streamId: string) => Promise<{ cancelled: boolean }>
    onChatStreamEvent: (listener: (event: ChatStreamEvent) => void) => () => void
    getProviderSettings: () => Promise<AiProviderSettings>
    updateProviderSettings: (settings: Partial<AiProviderSettings>) => Promise<AiProviderSettings>
    getProviderModels: () => Promise<AiModelInfo[]>
    getProviderStatus: () => Promise<AiProviderRuntimeStatus>
    getProviderMetrics: () => Promise<AiProviderMetrics[]>
    getOverlayState: () => Promise<AssistantOverlayState>
    setOverlayVisible: (visible: boolean) => Promise<AssistantOverlayState>
    setOverlayDocked: (docked: boolean) => Promise<AssistantOverlayState>
    setOverlayVoiceMode: (voiceMode: boolean) => Promise<AssistantOverlayState>
    setOverlayQuickAutomation: (enabled: boolean) => Promise<AssistantOverlayState>
    getShortcutBindings: () => Promise<GlobalShortcutBindings>
    setShortcutBindings: (bindings: Partial<GlobalShortcutBindings>) => Promise<GlobalShortcutBindings>
    getWorkspaceContext: () => Promise<WorkspaceContext | null>
    searchCommandPalette: (query: string) => Promise<CommandPaletteItem[]>
  }
  memory: {
    getRecentCommands: () => Promise<CommandLogRecord[]>
    getOverview: () => Promise<MemoryOverview>
    getCommandStats: () => Promise<CommandMemoryStats[]>
    getWorkflows: () => Promise<WorkflowDefinition[]>
    getProjects: () => Promise<ProjectMemory[]>
    getSuggestions: () => Promise<PersonalizationSuggestion[]>
    executeWorkflow: (workflowId: string) => Promise<{ ok: boolean; message: string }>
    getWorkflowSchedules: () => Promise<WorkflowSchedule[]>
    getWorkflowRuns: () => Promise<WorkflowRunRecord[]>
    generateWorkflowFromPrompt: (prompt: string) => Promise<WorkflowDefinition>
  }
  execution: {
    getRecentLogs: () => Promise<ActivityLogRecord[]>
    getRecentTasks: () => Promise<AssistantTask[]>
  }
  voice: {
    transcribe: (input: VoiceTranscriptionInput) => Promise<VoiceTranscriptionResult>
  }
  screen: {
    capture: (source?: 'full_screen' | 'active_window') => Promise<ScreenCaptureRecord>
    getActiveWindow: () => Promise<ActiveWindowInfo | null>
    analyzeLatest: () => Promise<ScreenAnalysisResult>
    getHistory: () => Promise<ScreenAnalysisResult[]>
  }
  automation?: {
    selfTest: () => Promise<{
      passed: number
      failed: number
      totalMs: number
      steps: { name: string; ok: boolean; message: string; ms: number }[]
      summary: string
    }>
    directExec: (type: string, params: Record<string, string>) => Promise<{ ok: boolean; message: string }>
    windowSnapshot: () => Promise<{
      source: string
      windows: { title: string; processName: string; pid: number; hwnd?: number; isFocused?: boolean; isMinimized?: boolean }[]
    }[]>
  }
  aiHealth?: {
    getStatus: () => Promise<AIHealthSnapshot>
    ping:      () => Promise<AIHealthSnapshot>
    setApiKey: (key: string) => Promise<{ ok: boolean; status?: AIHealthSnapshot; message?: string }>
  }
}

export interface AIHealthSnapshot {
  status:           'online' | 'offline' | 'degraded' | 'unknown'
  provider:         string
  model:            string
  apiKeyConfigured: boolean
  lastSuccessAt:    string | null
  lastFailureAt:    string | null
  lastError:        string | null
  successCount:     number
  failureCount:     number
  avgLatencyMs:     number | null
  retryCount:       number
}
