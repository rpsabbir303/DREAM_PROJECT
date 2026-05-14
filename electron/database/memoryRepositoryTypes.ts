import type {
  ActivityLogLevel,
  ActivityLogRecord,
  AssistantOverlayState,
  AiProviderMetrics,
  AiProviderSettings,
  AgentExecutionPlan,
  AgentExecutionState,
  AgentRunSummary,
  AssistantTask,
  AdaptiveRecommendation,
  BehaviorPattern,
  ChatMessage,
  CommandMemoryStats,
  CommandLogRecord,
  GlobalShortcutBindings,
  IndexingStatus,
  KnowledgeChunk,
  KnowledgeGraphEdge,
  KnowledgeGraphSnapshot,
  MemoryOverview,
  ObservabilityEvent,
  ObservabilitySnapshot,
  PersonalizationSuggestion,
  LearningFeedbackRecord,
  LearningSnapshot,
  ProactiveNotification,
  ProjectMemory,
  ScreenAnalysisResult,
  ScreenCaptureRecord,
  SemanticMemoryHit,
  SemanticSearchFilter,
  SemanticSearchResult,
  WorkspaceContext,
  WorkflowRunRecord,
  WorkflowSchedule,
  WorkflowDefinition,
  WorkflowOptimizationInsight,
} from '../../shared/interfaces/ipc.js'

export interface MemoryRepository {
  addCommandLog(command: string, result: CommandLogRecord['result']): string
  getRecentCommands(limit?: number): CommandLogRecord[]
  addChatMessage(message: Omit<ChatMessage, 'id' | 'createdAt'>): ChatMessage
  addTask(task: Omit<AssistantTask, 'id' | 'createdAt' | 'updatedAt'>): AssistantTask
  updateTaskStatus(id: string, status: AssistantTask['status']): void
  getRecentTasks(limit?: number): AssistantTask[]
  addActivityLog(level: ActivityLogLevel, message: string): ActivityLogRecord
  getRecentActivityLogs(limit?: number): ActivityLogRecord[]
  getRecentConversations(limit?: number): ChatMessage[]
  upsertCommandMemory(command: string): void
  getCommandMemoryStats(limit?: number): CommandMemoryStats[]
  getWorkflows(): WorkflowDefinition[]
  getProjects(): ProjectMemory[]
  getPersonalizationSuggestions(limit?: number): PersonalizationSuggestion[]
  createMemoryOverview(): MemoryOverview
  saveWorkflow(workflow: WorkflowDefinition): void
  addWorkflowRun(run: Omit<WorkflowRunRecord, 'id'>): WorkflowRunRecord
  getWorkflowRuns(limit?: number): WorkflowRunRecord[]
  getWorkflowSchedules(): WorkflowSchedule[]
  updateWorkflowScheduleLastRun(id: string, lastRunAt: string): void
  generateWorkflowFromPrompt(prompt: string): WorkflowDefinition
  addScreenCapture(capture: ScreenCaptureRecord): void
  addScreenAnalysis(analysis: ScreenAnalysisResult): void
  getRecentScreenAnalyses(limit?: number): ScreenAnalysisResult[]
  saveAgentPlan(plan: AgentExecutionPlan): void
  updateAgentPlanState(id: string, state: AgentExecutionState): void
  getAgentPlans(limit?: number): AgentExecutionPlan[]
  addAgentRun(run: Omit<AgentRunSummary, 'id'>): AgentRunSummary
  getAgentRuns(limit?: number): AgentRunSummary[]
  getAiSettings(): AiProviderSettings
  saveAiSettings(settings: Partial<AiProviderSettings>): AiProviderSettings
  addAiProviderMetric(metric: AiProviderMetrics): void
  getAiProviderMetrics(limit?: number): AiProviderMetrics[]
  upsertMemoryEmbedding(entry: Omit<SemanticMemoryHit, 'score'> & { vector: number[] }): void
  semanticSearch(query: string, limit?: number): SemanticMemoryHit[]
  getOverlayState(): AssistantOverlayState
  saveOverlayState(state: Partial<AssistantOverlayState>): AssistantOverlayState
  getShortcutBindings(): GlobalShortcutBindings
  saveShortcutBindings(bindings: Partial<GlobalShortcutBindings>): GlobalShortcutBindings
  addWorkspaceContext(context: WorkspaceContext): void
  getLatestWorkspaceContext(): WorkspaceContext | null
  setSkillEnabled(skillId: string, enabled: boolean): void
  getSkillEnabledStates(): Map<string, boolean>
  indexKnowledgeChunk(chunk: KnowledgeChunk, vector?: number[]): void
  clearKnowledgeIndex(): void
  semanticKnowledgeSearch(query: string, limit?: number, filter?: SemanticSearchFilter): SemanticSearchResult[]
  upsertKnowledgeGraphEdge(edge: Omit<KnowledgeGraphEdge, 'id'>): void
  getKnowledgeGraphSnapshot(limit?: number): KnowledgeGraphSnapshot
  getIndexingStatus(): IndexingStatus
  setIndexingStatus(status: Partial<IndexingStatus>): IndexingStatus
  addObservabilityEvent(event: Omit<ObservabilityEvent, 'id'>): ObservabilityEvent
  getRecentObservabilityEvents(limit?: number): ObservabilityEvent[]
  addProactiveNotification(
    notification: Omit<ProactiveNotification, 'id' | 'readAt'> & { readAt?: string | null },
  ): ProactiveNotification
  getRecentProactiveNotifications(limit?: number): ProactiveNotification[]
  markProactiveNotificationRead(notificationId: string): void
  getObservabilitySnapshot(): ObservabilitySnapshot
  addLearningFeedback(feedback: Omit<LearningFeedbackRecord, 'id'>): LearningFeedbackRecord
  getLearningFeedback(limit?: number): LearningFeedbackRecord[]
  upsertBehaviorPattern(pattern: BehaviorPattern): void
  getBehaviorPatterns(limit?: number): BehaviorPattern[]
  addAdaptiveRecommendation(recommendation: Omit<AdaptiveRecommendation, 'id'>): AdaptiveRecommendation
  getAdaptiveRecommendations(limit?: number): AdaptiveRecommendation[]
  setRecommendationStatus(id: string, status: AdaptiveRecommendation['status']): void
  addWorkflowOptimizationInsight(insight: Omit<WorkflowOptimizationInsight, 'id'>): WorkflowOptimizationInsight
  getWorkflowOptimizationInsights(limit?: number): WorkflowOptimizationInsight[]
  getLearningSnapshot(): LearningSnapshot
  createDefaultMemoriesIfNeeded(): void
}
