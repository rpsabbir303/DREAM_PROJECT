import type {
  ActivityLogRecord,
  AssistantOverlayState,
  AiModelInfo,
  AiProviderMetrics,
  AiProviderSettings,
  AgentExecutionPlan,
  AgentRunSummary,
  AssistantTask,
  ChatStartStreamInput,
  ChatStreamEvent,
  CommandMemoryStats,
  CommandLogRecord,
  CommandPaletteItem,
  ExecuteIntentResult,
  MemoryOverview,
  MultiAgentSession,
  ObservabilityEvent,
  ObservabilitySnapshot,
  LearningFeedbackRecord,
  BehaviorPattern,
  AdaptiveRecommendation,
  WorkflowOptimizationInsight,
  LearningSnapshot,
  ParsedIntent,
  PersonalizationSuggestion,
  ProductivityInsights,
  ProjectContext,
  ProjectMemory,
  ScreenAnalysisResult,
  ScreenCaptureRecord,
  SemanticMemoryHit,
  SkillCapabilityOverview,
  SkillDefinition,
  TerminalAnalysisResult,
  DevTask,
  UiUxAnalysisResult,
  GlobalShortcutBindings,
  IndexingStatus,
  KnowledgeGraphSnapshot,
  SemanticSearchFilter,
  SemanticSearchResult,
  ContextRetrievalResult,
  AgentPerformanceMetric,
  ProactiveNotification,
  WorkspaceContext,
  WorkflowRunRecord,
  WorkflowSchedule,
  SystemSnapshot,
  VoiceTranscriptionInput,
  VoiceTranscriptionResult,
  WorkflowDefinition,
} from '@shared/interfaces/ipc'

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

export const desktopClient = {
  async getSystemSnapshot(): Promise<SystemSnapshot> {
    return window.jarvis?.system.getSnapshot() ?? fallbackSnapshot
  },
  async parseIntent(input: string): Promise<ParsedIntent | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.parseIntent(input)
  },
  async executeIntent(input: string): Promise<ExecuteIntentResult | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.executeIntent(input)
  },
  async planGoal(goal: string): Promise<AgentExecutionPlan | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.planGoal(goal)
  },
  async executePlan(planId: string, allowRiskyActions = false): Promise<{ ok: boolean; message: string } | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.executePlan({ planId, allowRiskyActions })
  },
  async getAgentPlans(): Promise<AgentExecutionPlan[]> {
    return window.jarvis?.ai.getPlans() ?? []
  },
  async getAgentRuns(): Promise<AgentRunSummary[]> {
    return window.jarvis?.ai.getRuns() ?? []
  },
  async getAiProviderSettings(): Promise<AiProviderSettings | null> {
    return window.jarvis?.ai.getProviderSettings() ?? null
  },
  async updateAiProviderSettings(
    settings: Partial<AiProviderSettings>,
  ): Promise<AiProviderSettings | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.updateProviderSettings(settings)
  },
  async getAiProviderModels(): Promise<AiModelInfo[]> {
    return window.jarvis?.ai.getProviderModels() ?? []
  },
  async getAiProviderStatus(): Promise<{ online: boolean; ollamaReachable: boolean } | null> {
    return window.jarvis?.ai.getProviderStatus() ?? null
  },
  async getAiProviderMetrics(): Promise<AiProviderMetrics[]> {
    return window.jarvis?.ai.getProviderMetrics() ?? []
  },
  async semanticMemorySearch(query: string): Promise<SemanticMemoryHit[]> {
    if (!window.jarvis) return []
    return window.jarvis.ai.searchMemorySemantically(query)
  },
  async getOverlayState(): Promise<AssistantOverlayState | null> {
    return window.jarvis?.ai.getOverlayState() ?? null
  },
  async setOverlayVisible(visible: boolean): Promise<AssistantOverlayState | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.setOverlayVisible(visible)
  },
  async setOverlayDocked(docked: boolean): Promise<AssistantOverlayState | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.setOverlayDocked(docked)
  },
  async setOverlayVoiceMode(voiceMode: boolean): Promise<AssistantOverlayState | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.setOverlayVoiceMode(voiceMode)
  },
  async setOverlayQuickAutomation(enabled: boolean): Promise<AssistantOverlayState | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.setOverlayQuickAutomation(enabled)
  },
  async getShortcutBindings(): Promise<GlobalShortcutBindings | null> {
    return window.jarvis?.ai.getShortcutBindings() ?? null
  },
  async setShortcutBindings(bindings: Partial<GlobalShortcutBindings>): Promise<GlobalShortcutBindings | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.setShortcutBindings(bindings)
  },
  async getWorkspaceContext(): Promise<WorkspaceContext | null> {
    return window.jarvis?.ai.getWorkspaceContext() ?? null
  },
  async searchCommandPalette(query: string): Promise<CommandPaletteItem[]> {
    if (!window.jarvis) return []
    return window.jarvis.ai.searchCommandPalette(query)
  },
  async getProjectContext(): Promise<ProjectContext | null> {
    return window.jarvis?.ai.getProjectContext() ?? null
  },
  async analyzeTerminalOutput(text: string): Promise<TerminalAnalysisResult | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.analyzeTerminalOutput(text)
  },
  async analyzeUiUx(): Promise<UiUxAnalysisResult | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.analyzeUiUx()
  },
  async generateDevTasks(prompt: string): Promise<DevTask[]> {
    if (!window.jarvis) return []
    return window.jarvis.ai.generateDevTasks(prompt)
  },
  async getProductivityInsights(): Promise<ProductivityInsights | null> {
    return window.jarvis?.ai.getProductivityInsights() ?? null
  },
  async listSkills(): Promise<SkillDefinition[]> {
    return window.jarvis?.ai.listSkills() ?? []
  },
  async setSkillEnabled(skillId: string, enabled: boolean): Promise<SkillDefinition[]> {
    if (!window.jarvis) return []
    return window.jarvis.ai.setSkillEnabled({ skillId, enabled })
  },
  async getSkillCapabilityOverview(): Promise<SkillCapabilityOverview | null> {
    return window.jarvis?.ai.getSkillCapabilityOverview() ?? null
  },
  async executeSkillTool(payload: { skillId: string; toolCommand: string; input?: string }) {
    if (!window.jarvis) return { ok: false, message: 'Desktop bridge unavailable.' }
    return window.jarvis.ai.executeSkillTool(payload)
  },
  async reindexKnowledge() {
    if (!window.jarvis) return { ok: false as const, indexed: 0 }
    return window.jarvis.ai.reindexKnowledge()
  },
  async getIndexingStatus(): Promise<IndexingStatus | null> {
    return window.jarvis?.ai.getIndexingStatus() ?? null
  },
  async semanticKnowledgeSearch(payload: {
    query: string
    limit?: number
    filter?: SemanticSearchFilter
  }): Promise<SemanticSearchResult[]> {
    if (!window.jarvis) return []
    return window.jarvis.ai.semanticKnowledgeSearch(payload)
  },
  async getKnowledgeGraph(): Promise<KnowledgeGraphSnapshot | null> {
    return window.jarvis?.ai.getKnowledgeGraph() ?? null
  },
  async retrieveContext(query: string): Promise<ContextRetrievalResult | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.retrieveContext(query)
  },
  async runMultiAgentTask(goal: string): Promise<MultiAgentSession | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.runMultiAgentTask(goal)
  },
  async getMultiAgentSessions(): Promise<MultiAgentSession[]> {
    return window.jarvis?.ai.getMultiAgentSessions() ?? []
  },
  async getMultiAgentPerformance(): Promise<AgentPerformanceMetric[]> {
    return window.jarvis?.ai.getMultiAgentPerformance() ?? []
  },
  async getObservabilityEvents(): Promise<ObservabilityEvent[]> {
    return window.jarvis?.ai.getObservabilityEvents() ?? []
  },
  async getObservabilityNotifications(): Promise<ProactiveNotification[]> {
    return window.jarvis?.ai.getObservabilityNotifications() ?? []
  },
  async getObservabilitySnapshot(): Promise<ObservabilitySnapshot | null> {
    return window.jarvis?.ai.getObservabilitySnapshot() ?? null
  },
  async markObservabilityNotificationRead(notificationId: string) {
    if (!window.jarvis) return { ok: false as const }
    return window.jarvis.ai.markObservabilityNotificationRead(notificationId)
  },
  async getLearningFeedback(): Promise<LearningFeedbackRecord[]> {
    return window.jarvis?.ai.getLearningFeedback() ?? []
  },
  async getLearningPatterns(): Promise<BehaviorPattern[]> {
    return window.jarvis?.ai.getLearningPatterns() ?? []
  },
  async getLearningRecommendations(): Promise<AdaptiveRecommendation[]> {
    return window.jarvis?.ai.getLearningRecommendations() ?? []
  },
  async getLearningOptimizations(): Promise<WorkflowOptimizationInsight[]> {
    return window.jarvis?.ai.getLearningOptimizations() ?? []
  },
  async getLearningSnapshot(): Promise<LearningSnapshot | null> {
    return window.jarvis?.ai.getLearningSnapshot() ?? null
  },
  async refreshLearning(): Promise<LearningSnapshot | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.refreshLearning()
  },
  async setLearningRecommendationStatus(recommendationId: string, status: 'accepted' | 'dismissed') {
    if (!window.jarvis) return { ok: false as const }
    return window.jarvis.ai.setLearningRecommendationStatus({ recommendationId, status })
  },
  async startChatStream(input: ChatStartStreamInput): Promise<{ accepted: true } | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.startChatStream(input)
  },
  async cancelChatStream(streamId: string): Promise<{ cancelled: boolean } | null> {
    if (!window.jarvis) return null
    return window.jarvis.ai.cancelChatStream(streamId)
  },
  onChatStreamEvent(listener: (event: ChatStreamEvent) => void): () => void {
    if (!window.jarvis) return () => undefined
    return window.jarvis.ai.onChatStreamEvent(listener)
  },
  async getRecentCommands(): Promise<CommandLogRecord[]> {
    return window.jarvis?.memory.getRecentCommands() ?? []
  },
  async getMemoryOverview(): Promise<MemoryOverview | null> {
    return window.jarvis?.memory.getOverview() ?? null
  },
  async getCommandStats(): Promise<CommandMemoryStats[]> {
    return window.jarvis?.memory.getCommandStats() ?? []
  },
  async getWorkflows(): Promise<WorkflowDefinition[]> {
    return window.jarvis?.memory.getWorkflows() ?? []
  },
  async getProjects(): Promise<ProjectMemory[]> {
    return window.jarvis?.memory.getProjects() ?? []
  },
  async getSuggestions(): Promise<PersonalizationSuggestion[]> {
    return window.jarvis?.memory.getSuggestions() ?? []
  },
  async executeWorkflow(workflowId: string): Promise<{ ok: boolean; message: string } | null> {
    if (!window.jarvis) return null
    return window.jarvis.memory.executeWorkflow(workflowId)
  },
  async getWorkflowSchedules(): Promise<WorkflowSchedule[]> {
    return window.jarvis?.memory.getWorkflowSchedules() ?? []
  },
  async getWorkflowRuns(): Promise<WorkflowRunRecord[]> {
    return window.jarvis?.memory.getWorkflowRuns() ?? []
  },
  async generateWorkflowFromPrompt(prompt: string): Promise<WorkflowDefinition | null> {
    if (!window.jarvis) return null
    return window.jarvis.memory.generateWorkflowFromPrompt(prompt)
  },
  async getRecentExecutionLogs(): Promise<ActivityLogRecord[]> {
    return window.jarvis?.execution.getRecentLogs() ?? []
  },
  async getRecentTasks(): Promise<AssistantTask[]> {
    return window.jarvis?.execution.getRecentTasks() ?? []
  },
  async transcribeAudio(input: VoiceTranscriptionInput): Promise<VoiceTranscriptionResult | null> {
    if (!window.jarvis) return null
    return window.jarvis.voice.transcribe(input)
  },
  async captureScreen(source: 'full_screen' | 'active_window' = 'full_screen'): Promise<ScreenCaptureRecord | null> {
    if (!window.jarvis) return null
    return window.jarvis.screen.capture(source)
  },
  async getActiveWindow() {
    return window.jarvis?.screen.getActiveWindow() ?? null
  },
  async analyzeLatestScreen(): Promise<ScreenAnalysisResult | null> {
    if (!window.jarvis) return null
    return window.jarvis.screen.analyzeLatest()
  },
  async getScreenHistory(): Promise<ScreenAnalysisResult[]> {
    return window.jarvis?.screen.getHistory() ?? []
  },
}
