import type {
  ActivityLogRecord,
  AssistantOverlayState,
  AiModelInfo,
  AiProviderMetrics,
  AiProviderSettings,
  AgentExecutionPlan,
  AgentRunSummary,
  ActiveWindowInfo,
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
  AgentPerformanceMetric,
  ProactiveNotification,
  ContextRetrievalResult,
  WorkspaceContext,
  WorkflowRunRecord,
  WorkflowSchedule,
  SystemSnapshot,
  VoiceTranscriptionInput,
  VoiceTranscriptionResult,
  WorkflowDefinition,
} from '../interfaces/ipc.js'

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
    planGoal: (goal: string) => Promise<AgentExecutionPlan>
    executePlan: (payload: { planId: string; allowRiskyActions?: boolean }) => Promise<{ ok: boolean; message: string }>
    getPlans: () => Promise<AgentExecutionPlan[]>
    getRuns: () => Promise<AgentRunSummary[]>
    getProviderSettings: () => Promise<AiProviderSettings>
    updateProviderSettings: (settings: Partial<AiProviderSettings>) => Promise<AiProviderSettings>
    getProviderModels: () => Promise<AiModelInfo[]>
    getProviderStatus: () => Promise<{ online: boolean; ollamaReachable: boolean }>
    getProviderMetrics: () => Promise<AiProviderMetrics[]>
    searchMemorySemantically: (query: string) => Promise<SemanticMemoryHit[]>
    getOverlayState: () => Promise<AssistantOverlayState>
    setOverlayVisible: (visible: boolean) => Promise<AssistantOverlayState>
    setOverlayDocked: (docked: boolean) => Promise<AssistantOverlayState>
    setOverlayVoiceMode: (voiceMode: boolean) => Promise<AssistantOverlayState>
    setOverlayQuickAutomation: (enabled: boolean) => Promise<AssistantOverlayState>
    getShortcutBindings: () => Promise<GlobalShortcutBindings>
    setShortcutBindings: (bindings: Partial<GlobalShortcutBindings>) => Promise<GlobalShortcutBindings>
    getWorkspaceContext: () => Promise<WorkspaceContext | null>
    searchCommandPalette: (query: string) => Promise<CommandPaletteItem[]>
    getProjectContext: () => Promise<ProjectContext>
    analyzeTerminalOutput: (text: string) => Promise<TerminalAnalysisResult>
    analyzeUiUx: () => Promise<UiUxAnalysisResult>
    generateDevTasks: (prompt: string) => Promise<DevTask[]>
    getProductivityInsights: () => Promise<ProductivityInsights>
    listSkills: () => Promise<SkillDefinition[]>
    setSkillEnabled: (payload: { skillId: string; enabled: boolean }) => Promise<SkillDefinition[]>
    getSkillCapabilityOverview: () => Promise<SkillCapabilityOverview>
    executeSkillTool: (payload: { skillId: string; toolCommand: string; input?: string }) => Promise<{ ok: boolean; message: string }>
    reindexKnowledge: () => Promise<{ ok: boolean; indexed: number }>
    getIndexingStatus: () => Promise<IndexingStatus>
    semanticKnowledgeSearch: (payload: {
      query: string
      limit?: number
      filter?: SemanticSearchFilter
    }) => Promise<SemanticSearchResult[]>
    getKnowledgeGraph: () => Promise<KnowledgeGraphSnapshot>
    retrieveContext: (query: string) => Promise<ContextRetrievalResult>
    runMultiAgentTask: (goal: string) => Promise<MultiAgentSession>
    getMultiAgentSessions: () => Promise<MultiAgentSession[]>
    getMultiAgentPerformance: () => Promise<AgentPerformanceMetric[]>
    getObservabilityEvents: () => Promise<ObservabilityEvent[]>
    getObservabilityNotifications: () => Promise<ProactiveNotification[]>
    getObservabilitySnapshot: () => Promise<ObservabilitySnapshot>
    markObservabilityNotificationRead: (notificationId: string) => Promise<{ ok: boolean }>
    getLearningFeedback: () => Promise<LearningFeedbackRecord[]>
    getLearningPatterns: () => Promise<BehaviorPattern[]>
    getLearningRecommendations: () => Promise<AdaptiveRecommendation[]>
    getLearningOptimizations: () => Promise<WorkflowOptimizationInsight[]>
    getLearningSnapshot: () => Promise<LearningSnapshot>
    refreshLearning: () => Promise<LearningSnapshot>
    setLearningRecommendationStatus: (payload: {
      recommendationId: string
      status: 'accepted' | 'dismissed'
    }) => Promise<{ ok: boolean }>
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
}
