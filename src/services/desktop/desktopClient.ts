import type {
  ActivityLogRecord,
  AssistantOverlayState,
  AiModelInfo,
  AiProviderMetrics,
  AiProviderRuntimeStatus,
  AiProviderSettings,
  AssistantTask,
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
  IndexingStatus,
  KnowledgeGraphSnapshot,
  SemanticSearchFilter,
  SemanticSearchResult,
  ContextRetrievalResult,
  WorkspaceContext,
  WorkflowRunRecord,
  WorkflowSchedule,
  SystemSnapshot,
  VoiceTranscriptionInput,
  VoiceTranscriptionResult,
  WorkflowDefinition,
  ActiveWindowInfo,
  SemanticMemoryHit,
  AgentExecutionPlan,
  AgentRunSummary,
  MultiAgentSession,
  AgentPerformanceMetric,
  ObservabilityEvent,
  ObservabilitySnapshot,
  ProactiveNotification,
  LearningFeedbackRecord,
  BehaviorPattern,
  AdaptiveRecommendation,
  WorkflowOptimizationInsight,
  LearningSnapshot,
  ProjectContext,
  ProductivityInsights,
  TerminalAnalysisResult,
  UiUxAnalysisResult,
  DevTask,
  SkillDefinition,
  SkillCapabilityOverview,
} from '@shared/interfaces/ipc'
import type { JarvisDesktopApi } from '@shared/types'

const fallbackSnapshot: SystemSnapshot = {
  cpuUsagePercent: 0,
  memoryUsagePercent: 0,
  memoryUsedGb: 0,
  memoryTotalGb: 0,
  diskUsagePercent: 0,
  diskUsedGb: 0,
  diskTotalGb: 0,
  gpuUsagePercent: null,
  uptimeSeconds: 0,
  activeProcesses: 0,
  osPlatform: 'unknown',
  osRelease: 'unknown',
  osArch: 'unknown',
  hostname: 'local-machine',
  timestamp: Date.now(),
}

/** Electron preload bridge (`jarvis` and `electron` expose the same API — prefer `jarvis` to avoid name clashes). */
function desktopBridge(): JarvisDesktopApi | undefined {
  return window.jarvis ?? window.electron
}

/** True when preload ran and exposed the desktop API (read in renderer after load). */
export function isDesktopBridgeAvailable(): boolean {
  return Boolean(window.jarvis ?? window.electron)
}

/**
 * Typed bridge to the Electron preload API (`window.jarvis` / `window.electron`).
 */
export const desktopClient = {
  async getSystemSnapshot(): Promise<SystemSnapshot> {
    return desktopBridge()?.system.getSnapshot() ?? fallbackSnapshot
  },
  async parseIntent(input: string): Promise<ParsedIntent | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.ai.parseIntent(input)
  },
  async executeIntent(input: string): Promise<ExecuteIntentResult | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.ai.executeIntent(input)
  },
  async getAiProviderSettings(): Promise<AiProviderSettings | null> {
    return desktopBridge()?.ai.getProviderSettings() ?? null
  },
  async updateAiProviderSettings(
    settings: Partial<AiProviderSettings>,
  ): Promise<AiProviderSettings | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.ai.updateProviderSettings(settings)
  },
  async getAiProviderModels(): Promise<AiModelInfo[]> {
    return desktopBridge()?.ai.getProviderModels() ?? []
  },
  async getAiProviderStatus(): Promise<AiProviderRuntimeStatus | null> {
    return desktopBridge()?.ai.getProviderStatus() ?? null
  },
  async getAiProviderMetrics(): Promise<AiProviderMetrics[]> {
    return desktopBridge()?.ai.getProviderMetrics() ?? []
  },
  async getOverlayState(): Promise<AssistantOverlayState | null> {
    return desktopBridge()?.ai.getOverlayState() ?? null
  },
  async setOverlayVisible(visible: boolean): Promise<AssistantOverlayState | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.ai.setOverlayVisible(visible)
  },
  async setOverlayDocked(docked: boolean): Promise<AssistantOverlayState | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.ai.setOverlayDocked(docked)
  },
  async setOverlayVoiceMode(voiceMode: boolean): Promise<AssistantOverlayState | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.ai.setOverlayVoiceMode(voiceMode)
  },
  async setOverlayQuickAutomation(enabled: boolean): Promise<AssistantOverlayState | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.ai.setOverlayQuickAutomation(enabled)
  },
  async getShortcutBindings(): Promise<GlobalShortcutBindings | null> {
    return desktopBridge()?.ai.getShortcutBindings() ?? null
  },
  async setShortcutBindings(bindings: Partial<GlobalShortcutBindings>): Promise<GlobalShortcutBindings | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.ai.setShortcutBindings(bindings)
  },
  async getWorkspaceContext(): Promise<WorkspaceContext | null> {
    return desktopBridge()?.ai.getWorkspaceContext() ?? null
  },
  async searchCommandPalette(query: string): Promise<CommandPaletteItem[]> {
    const d = desktopBridge()
    if (!d) return []
    return d.ai.searchCommandPalette(query)
  },
  async startChatStream(input: ChatStartStreamInput): Promise<{ accepted: true } | null> {
    const d = desktopBridge()
    if (!d) {
      console.warn('[JARVIS_IPC] startChatStream: no desktop bridge', {
        hasJarvis: Boolean(window.jarvis),
        hasElectron: Boolean(window.electron),
      })
      return null
    }
    console.info('[JARVIS_IPC] startChatStream invoke', input.streamId, 'chars=', input.input.length)
    try {
      const result = await d.ai.startChatStream(input)
      console.info('[JARVIS_IPC] startChatStream resolved', result)
      return result
    } catch (err) {
      console.error('[JARVIS_IPC] startChatStream invoke error', err)
      throw err
    }
  },
  async cancelChatStream(streamId: string): Promise<{ cancelled: boolean } | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.ai.cancelChatStream(streamId)
  },
  onChatStreamEvent(listener: (event: ChatStreamEvent) => void): () => void {
    const d = desktopBridge()
    if (!d) return () => undefined
    return d.ai.onChatStreamEvent(listener)
  },
  async getRecentCommands(): Promise<CommandLogRecord[]> {
    return desktopBridge()?.memory.getRecentCommands() ?? []
  },
  async getMemoryOverview(): Promise<MemoryOverview | null> {
    return desktopBridge()?.memory.getOverview() ?? null
  },
  async getCommandStats(): Promise<CommandMemoryStats[]> {
    return desktopBridge()?.memory.getCommandStats() ?? []
  },
  async getWorkflows(): Promise<WorkflowDefinition[]> {
    return desktopBridge()?.memory.getWorkflows() ?? []
  },
  async getProjects(): Promise<ProjectMemory[]> {
    return desktopBridge()?.memory.getProjects() ?? []
  },
  async getSuggestions(): Promise<PersonalizationSuggestion[]> {
    return desktopBridge()?.memory.getSuggestions() ?? []
  },
  async executeWorkflow(workflowId: string): Promise<{ ok: boolean; message: string } | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.memory.executeWorkflow(workflowId)
  },
  async getWorkflowSchedules(): Promise<WorkflowSchedule[]> {
    return desktopBridge()?.memory.getWorkflowSchedules() ?? []
  },
  async getWorkflowRuns(): Promise<WorkflowRunRecord[]> {
    return desktopBridge()?.memory.getWorkflowRuns() ?? []
  },
  async generateWorkflowFromPrompt(prompt: string): Promise<WorkflowDefinition | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.memory.generateWorkflowFromPrompt(prompt)
  },
  async getRecentExecutionLogs(): Promise<ActivityLogRecord[]> {
    return desktopBridge()?.execution.getRecentLogs() ?? []
  },
  async getRecentTasks(): Promise<AssistantTask[]> {
    return desktopBridge()?.execution.getRecentTasks() ?? []
  },
  async transcribeAudio(input: VoiceTranscriptionInput): Promise<VoiceTranscriptionResult | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.voice.transcribe(input)
  },
  async captureScreen(source: 'full_screen' | 'active_window' = 'full_screen'): Promise<ScreenCaptureRecord | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.screen.capture(source)
  },
  async getActiveWindow(): Promise<ActiveWindowInfo | null> {
    return desktopBridge()?.screen.getActiveWindow() ?? null
  },
  async analyzeLatestScreen(): Promise<ScreenAnalysisResult | null> {
    const d = desktopBridge()
    if (!d) return null
    return d.screen.analyzeLatest()
  },
  async getScreenHistory(): Promise<ScreenAnalysisResult[]> {
    return desktopBridge()?.screen.getHistory() ?? []
  },

  /**
   * MVP memory search: substring match over recent shell commands (no vector DB).
   */
  async semanticMemorySearch(query: string): Promise<SemanticMemoryHit[]> {
    const d = desktopBridge()
    if (!d) return []
    const q = query.trim().toLowerCase()
    if (!q) return []
    const records = await d.memory.getRecentCommands()
    return records
      .filter((r) => r.command.toLowerCase().includes(q))
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        kind: 'command' as const,
        content: r.command,
        score: 1,
        createdAt: r.createdAt,
      }))
  },

  // --- Stubs for legacy store imports (advanced features disabled in MVP) ---
  async getIndexingStatus(): Promise<IndexingStatus | null> {
    return null
  },
  async reindexKnowledge(): Promise<{ ok: boolean; indexed: number }> {
    return { ok: false, indexed: 0 }
  },
  async semanticKnowledgeSearch(_payload: {
    query: string
    limit?: number
    filter?: SemanticSearchFilter
  }): Promise<SemanticSearchResult[]> {
    void _payload
    return []
  },
  async getKnowledgeGraph(): Promise<KnowledgeGraphSnapshot | null> {
    return null
  },
  async retrieveContext(query: string): Promise<ContextRetrievalResult | null> {
    void query
    return null
  },
  async getProjectContext(): Promise<ProjectContext | null> {
    return null
  },
  async getProductivityInsights(): Promise<ProductivityInsights | null> {
    return null
  },
  async analyzeTerminalOutput(text: string): Promise<TerminalAnalysisResult | null> {
    void text
    return null
  },
  async analyzeUiUx(): Promise<UiUxAnalysisResult | null> {
    return null
  },
  async generateDevTasks(_prompt: string): Promise<DevTask[]> {
    void _prompt
    return []
  },
  async listSkills(): Promise<SkillDefinition[]> {
    return []
  },
  async setSkillEnabled(_payload: { skillId: string; enabled: boolean }): Promise<SkillDefinition[]> {
    void _payload
    return []
  },
  async getSkillCapabilityOverview(): Promise<SkillCapabilityOverview | null> {
    return null
  },
  async executeSkillTool(_payload: {
    skillId: string
    toolCommand: string
    input?: string
  }): Promise<{ ok: boolean; message: string }> {
    void _payload
    return { ok: false, message: 'Skills are not available in the MVP build.' }
  },
  async getAgentPlans(): Promise<AgentExecutionPlan[]> {
    return []
  },
  async getAgentRuns(): Promise<AgentRunSummary[]> {
    return []
  },
  async planGoal(_goal: string): Promise<AgentExecutionPlan | null> {
    void _goal
    return null
  },
  async executePlan(_payload: { planId: string; allowRiskyActions?: boolean }): Promise<{
    ok: boolean
    message: string
  } | null> {
    void _payload
    return { ok: false, message: 'Agent planner is not available in the MVP build.' }
  },
  async runMultiAgentTask(_goal: string): Promise<MultiAgentSession | null> {
    void _goal
    return null
  },
  async getMultiAgentSessions(): Promise<MultiAgentSession[]> {
    return []
  },
  async getMultiAgentPerformance(): Promise<AgentPerformanceMetric[]> {
    return []
  },
  async getObservabilityEvents(): Promise<ObservabilityEvent[]> {
    return []
  },
  async getObservabilityNotifications(): Promise<ProactiveNotification[]> {
    return []
  },
  async getObservabilitySnapshot(): Promise<ObservabilitySnapshot | null> {
    return null
  },
  async markObservabilityNotificationRead(_id: string): Promise<{ ok: boolean }> {
    void _id
    return { ok: false }
  },
  async getLearningFeedback(): Promise<LearningFeedbackRecord[]> {
    return []
  },
  async getLearningPatterns(): Promise<BehaviorPattern[]> {
    return []
  },
  async getLearningRecommendations(): Promise<AdaptiveRecommendation[]> {
    return []
  },
  async getLearningOptimizations(): Promise<WorkflowOptimizationInsight[]> {
    return []
  },
  async getLearningSnapshot(): Promise<LearningSnapshot | null> {
    return null
  },
  async refreshLearning(): Promise<LearningSnapshot | null> {
    return null
  },
  async setLearningRecommendationStatus(_payload: {
    recommendationId: string
    status: 'accepted' | 'dismissed'
  }): Promise<{ ok: boolean }> {
    void _payload
    return { ok: false }
  },
  async selfTest(): Promise<{
    passed: number
    failed: number
    totalMs: number
    steps: { name: string; ok: boolean; message: string; ms: number }[]
    summary: string
  } | null> {
    return desktopBridge()?.automation?.selfTest() ?? null
  },
  async directExec(type: string, params: Record<string, string> = {}): Promise<{ ok: boolean; message: string }> {
    return desktopBridge()?.automation?.directExec(type, params) ?? { ok: false, message: 'No desktop bridge' }
  },
  async windowSnapshot(): Promise<{
    source: string
    windows: { title: string; processName: string; pid: number; hwnd?: number; isFocused?: boolean; isMinimized?: boolean }[]
  }[]> {
    return desktopBridge()?.automation?.windowSnapshot() ?? []
  },
}
