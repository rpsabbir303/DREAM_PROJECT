export interface SystemSnapshot {
  cpuUsagePercent: number
  memoryUsagePercent: number
  memoryUsedGb: number
  memoryTotalGb: number
  diskUsagePercent: number
  diskUsedGb: number
  diskTotalGb: number
  gpuUsagePercent: number | null
  uptimeSeconds: number
  activeProcesses: number
  osPlatform: string
  osRelease: string
  osArch: string
  hostname: string
  timestamp: number
}

export type AssistantIntentType =
  | 'open_application'
  | 'open_url'
  | 'open_folder'
  | 'open_project'
  | 'system_monitoring'
  | 'run_safe_command'
  | 'chat_general'
  | 'unknown'

export interface ParsedIntent {
  intent: AssistantIntentType
  target: string
  confidence: number
  rawInput: string
}

export interface CommandUnderstanding {
  intent: AssistantIntentType
  target: string | null
  actionRequired: boolean
  confidence: number
  reasoning: string
}

export type TaskStatus = 'pending' | 'validating' | 'running' | 'completed' | 'failed'

export interface AssistantTask {
  id: string
  title: string
  intent: AssistantIntentType
  target: string | null
  status: TaskStatus
  createdAt: string
  updatedAt: string
}

export type ActivityLogLevel = 'info' | 'warning' | 'error'

export interface ActivityLogRecord {
  id: string
  level: ActivityLogLevel
  message: string
  createdAt: string
}

export type ExecutionActionType = 'open_application' | 'open_path' | 'open_url' | 'run_terminal'

export interface ExecutionResult {
  ok: boolean
  actionType: ExecutionActionType
  message: string
  output?: string
  error?: string
}

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
}

export interface ChatStartStreamInput {
  streamId: string
  input: string
  history: ChatMessage[]
}

export type ChatStreamEvent =
  | { streamId: string; type: 'start' }
  | { streamId: string; type: 'provider'; data: AiRoutingDecision }
  | { streamId: string; type: 'intent'; data: CommandUnderstanding }
  | { streamId: string; type: 'task'; data: AssistantTask }
  | { streamId: string; type: 'task-status'; data: { taskId: string; status: TaskStatus } }
  | { streamId: string; type: 'execution'; data: ExecutionResult }
  | { streamId: string; type: 'delta'; data: { chunk: string } }
  | { streamId: string; type: 'complete'; data: { finalText: string } }
  | { streamId: string; type: 'error'; data: { message: string } }

export interface ExecuteIntentResult {
  ok: boolean
  message: string
  logId: string
}

export interface CommandLogRecord {
  id: string
  command: string
  result: 'success' | 'warning' | 'error'
  createdAt: string
}

export interface VoiceTranscriptionInput {
  audioBase64: string
  mimeType: string
}

export interface VoiceTranscriptionResult {
  text: string
  durationMs: number
}

export interface WorkflowStep {
  id: string
  type: ExecutionActionType
  payload: string
  order: number
}

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  steps: WorkflowStep[]
}

export type ScheduleType = 'manual' | 'daily' | 'weekly' | 'once'

export interface WorkflowSchedule {
  id: string
  workflowId: string
  scheduleType: ScheduleType
  timeOfDay: string | null
  dayOfWeek: number | null
  runAt: string | null
  isEnabled: boolean
  lastRunAt: string | null
  createdAt: string
}

export type WorkflowRunStatus = 'running' | 'completed' | 'failed'

export interface WorkflowRunRecord {
  id: string
  workflowId: string
  workflowName: string
  status: WorkflowRunStatus
  startedAt: string
  completedAt: string | null
  message: string
}

export interface ProjectMemory {
  id: string
  name: string
  folderPath: string
  startupCommands: string[]
  applications: string[]
  updatedAt: string
}

export interface CommandMemoryStats {
  command: string
  usageCount: number
  lastUsedAt: string
  isFavorite: boolean
}

export interface PersonalizationSuggestion {
  id: string
  message: string
  confidence: number
  createdAt: string
}

export interface MemoryOverview {
  recentConversations: ChatMessage[]
  commandStats: CommandMemoryStats[]
  workflows: WorkflowDefinition[]
  projects: ProjectMemory[]
  suggestions: PersonalizationSuggestion[]
}

export interface ActiveWindowInfo {
  app: string
  title: string
  processName: string
}

export interface ScreenCaptureRecord {
  id: string
  imageBase64: string
  width: number
  height: number
  createdAt: string
  source: 'full_screen' | 'active_window'
}

export interface OcrResult {
  text: string
  confidence: number
  createdAt: string
}

export interface ScreenAnalysisResult {
  id: string
  summary: string
  ocrText: string
  confidence: number
  activeWindow: ActiveWindowInfo | null
  createdAt: string
}

export type AgentExecutionState =
  | 'planning'
  | 'validating'
  | 'executing'
  | 'waiting'
  | 'retrying'
  | 'failed'
  | 'completed'

export interface AgentPlanStep {
  id: string
  title: string
  actionType: ExecutionActionType
  target: string
  order: number
  dependsOnStepIds: string[]
  requiresConfirmation: boolean
  retryLimit: number
}

export interface AgentExecutionPlan {
  id: string
  goal: string
  reasoning: string
  state: AgentExecutionState
  steps: AgentPlanStep[]
  createdAt: string
  updatedAt: string
}

export interface AgentRunSummary {
  id: string
  planId: string
  goal: string
  state: AgentExecutionState
  startedAt: string
  completedAt: string | null
  message: string
}

export type AiProvider = 'openai' | 'ollama'

export interface AiProviderSettings {
  preferredProvider: AiProvider
  offlineMode: boolean
  localModel: string
  cloudModel: string
  reasoningThreshold: number
  updatedAt: string
}

export interface AiModelInfo {
  name: string
  provider: AiProvider
  available: boolean
}

export interface AiRoutingDecision {
  provider: AiProvider
  model: string
  reason: string
  isOffline: boolean
}

export interface AiProviderMetrics {
  provider: AiProvider
  model: string
  latencyMs: number
  inputChars: number
  outputChars: number
  createdAt: string
}

export interface SemanticMemoryHit {
  id: string
  kind: 'chat' | 'command' | 'workflow' | 'project'
  content: string
  score: number
  createdAt: string
}

export interface AssistantOverlayState {
  visible: boolean
  docked: boolean
  voiceMode: boolean
  quickAutomation: boolean
  updatedAt: string
}

export interface GlobalShortcutBindings {
  toggleOverlay: string
  toggleVoice: string
  quickAutomation: string
}

export interface WorkspaceContext {
  app: string
  title: string
  processName: string
  timestamp: string
}

export interface CommandPaletteItem {
  id: string
  label: string
  description: string
  category: 'command' | 'workflow' | 'memory' | 'action'
  payload: string
}

export interface ProjectContext {
  rootPath: string
  projectName: string
  frameworks: string[]
  projectType: 'frontend' | 'backend' | 'desktop' | 'fullstack' | 'unknown'
  scripts: string[]
  dependencies: string[]
  devDependencies: string[]
  detectedAt: string
}

export interface TerminalIssue {
  id: string
  level: 'error' | 'warning'
  category: 'typescript' | 'build' | 'runtime' | 'dependency' | 'unknown'
  message: string
  suggestion: string
}

export interface TerminalAnalysisResult {
  summary: string
  issues: TerminalIssue[]
  createdAt: string
}

export interface UiUxInsight {
  id: string
  category: 'layout' | 'spacing' | 'typography' | 'accessibility' | 'consistency'
  severity: 'low' | 'medium' | 'high'
  message: string
}

export interface UiUxAnalysisResult {
  summary: string
  insights: UiUxInsight[]
  createdAt: string
}

export interface DevTask {
  id: string
  title: string
  area: 'frontend' | 'backend' | 'qa' | 'devops'
  priority: 'low' | 'medium' | 'high'
  steps: string[]
}

export interface ProductivityInsights {
  projectContext: ProjectContext | null
  latestTerminalSummary: string
  latestUiUxSummary: string
  suggestedNextStep: string
  createdAt: string
}

export type SkillPermission =
  | 'read_memory'
  | 'run_workflow'
  | 'analyze_terminal'
  | 'analyze_ui'
  | 'open_application'
  | 'internet_access'

export interface SkillTool {
  id: string
  name: string
  description: string
  command: string
}

export interface SkillDefinition {
  id: string
  name: string
  description: string
  category: 'developer' | 'design' | 'browser' | 'productivity' | 'system'
  permissions: SkillPermission[]
  tools: SkillTool[]
  commands: string[]
  enabled: boolean
}

export interface SkillCapabilityOverview {
  totalSkills: number
  enabledSkills: number
  toolCount: number
  commandCount: number
}

export type KnowledgeSourceType =
  | 'conversation'
  | 'workflow'
  | 'project_file'
  | 'screenshot'
  | 'terminal_log'
  | 'activity'
  | 'note'

export interface KnowledgeChunk {
  id: string
  sourceType: KnowledgeSourceType
  sourceRef: string
  content: string
  metadata: Record<string, string>
  indexedAt: string
}

export interface SemanticSearchFilter {
  sourceTypes?: KnowledgeSourceType[]
  fromDate?: string
  toDate?: string
}

export interface SemanticSearchResult {
  chunk: KnowledgeChunk
  score: number
}

export interface KnowledgeGraphNode {
  id: string
  type: 'workflow' | 'command' | 'project' | 'conversation' | 'file'
  label: string
}

export interface KnowledgeGraphEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  relation: string
}

export interface KnowledgeGraphSnapshot {
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  updatedAt: string
}

export interface IndexingStatus {
  isRunning: boolean
  lastIndexedAt: string | null
  indexedChunkCount: number
}

export interface ContextRetrievalResult {
  summary: string
  snippets: string[]
  sources: string[]
}

export type SpecializedAgentId = 'coordinator' | 'developer' | 'uiux' | 'research' | 'memory' | 'automation'
export type AgentExecutionStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface AgentMessage {
  id: string
  fromAgent: SpecializedAgentId
  toAgent: SpecializedAgentId | 'broadcast'
  content: string
  createdAt: string
}

export interface AgentExecutionNode {
  agentId: SpecializedAgentId
  status: AgentExecutionStatus
  startedAt: string | null
  completedAt: string | null
  output: string | null
}

export interface MultiAgentSession {
  id: string
  goal: string
  status: AgentExecutionStatus
  selectedAgents: SpecializedAgentId[]
  nodes: AgentExecutionNode[]
  mergedOutput: string
  messages: AgentMessage[]
  createdAt: string
  completedAt: string | null
}

export interface AgentPerformanceMetric {
  agentId: SpecializedAgentId
  runs: number
  avgLatencyMs: number
  successRate: number
}

export type ObservabilityEventType =
  | 'app_opened'
  | 'workspace_changed'
  | 'terminal_error'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'ai_task_failed'
  | 'system_resource_alert'
  | 'knowledge_indexed'

export interface ObservabilityEvent {
  id: string
  type: ObservabilityEventType
  source: 'workspace' | 'system' | 'workflow' | 'task' | 'ai' | 'knowledge' | 'manual'
  severity: 'info' | 'warning' | 'error'
  title: string
  message: string
  metadata: Record<string, string>
  createdAt: string
}

export interface ProactiveNotification {
  id: string
  level: 'info' | 'warning' | 'critical'
  title: string
  message: string
  eventId: string | null
  actionLabel: string | null
  createdAt: string
  readAt: string | null
}

export interface ObservabilitySnapshot {
  events: ObservabilityEvent[]
  notifications: ProactiveNotification[]
  activeAlerts: number
  updatedAt: string
}

export type LearningFeedbackType =
  | 'execution_success'
  | 'execution_failure'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'user_correction'
  | 'recommendation_accepted'
  | 'recommendation_dismissed'

export interface LearningFeedbackRecord {
  id: string
  type: LearningFeedbackType
  source: 'chat' | 'workflow' | 'automation' | 'overlay' | 'system'
  action: string
  outcome: 'success' | 'failure' | 'neutral'
  score: number
  metadata: Record<string, string>
  createdAt: string
}

export interface BehaviorPattern {
  id: string
  name: string
  description: string
  category: 'routine' | 'sequence' | 'workflow' | 'command'
  confidence: number
  frequency: number
  lastSeenAt: string
  relatedActions: string[]
}

export interface AdaptiveRecommendation {
  id: string
  title: string
  message: string
  category: 'workflow' | 'automation' | 'shortcut' | 'optimization'
  confidence: number
  impactScore: number
  sourcePatternId: string | null
  status: 'active' | 'accepted' | 'dismissed'
  createdAt: string
}

export interface WorkflowOptimizationInsight {
  id: string
  workflowId: string | null
  workflowName: string
  issue: string
  suggestion: string
  confidence: number
  estimatedImpact: number
  createdAt: string
}

export interface LearningSnapshot {
  feedback: LearningFeedbackRecord[]
  patterns: BehaviorPattern[]
  recommendations: AdaptiveRecommendation[]
  optimizations: WorkflowOptimizationInsight[]
  adaptationScore: number
  updatedAt: string
}
