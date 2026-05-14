import { randomUUID } from 'node:crypto'
import type { MemoryRepository } from './memoryRepositoryTypes.js'
import type {
  ActivityLogRecord,
  AdaptiveRecommendation,
  AgentExecutionPlan,
  AgentRunSummary,
  AiProviderMetrics,
  AiProviderSettings,
  AssistantOverlayState,
  AssistantTask,
  BehaviorPattern,
  ChatMessage,
  CommandLogRecord,
  CommandMemoryStats,
  GlobalShortcutBindings,
  IndexingStatus,
  KnowledgeChunk,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphSnapshot,
  LearningFeedbackRecord,
  LearningSnapshot,
  MemoryOverview,
  ObservabilityEvent,
  ObservabilitySnapshot,
  PersonalizationSuggestion,
  ProactiveNotification,
  ProjectMemory,
  ScreenAnalysisResult,
  ScreenCaptureRecord,
  SemanticMemoryHit,
  SemanticSearchFilter,
  SemanticSearchResult,
  WorkflowDefinition,
  WorkflowOptimizationInsight,
  WorkflowRunRecord,
  WorkflowSchedule,
  WorkspaceContext,
} from '../../shared/interfaces/ipc.js'
import { cosineSimilarity, createLocalEmbedding } from '../ai/localEmbeddings.js'

type MemoryEmbeddingRow = {
  id: string
  kind: SemanticMemoryHit['kind']
  content: string
  vector: number[]
  createdAt: string
}

type KnowledgeChunkRow = {
  id: string
  sourceType: KnowledgeChunk['sourceType']
  sourceRef: string
  content: string
  metadata: Record<string, string>
  embedding: number[]
  indexedAt: string
}

export function createInMemoryMemoryRepository(): MemoryRepository {
  const commandLogs: CommandLogRecord[] = []
  const chatMessages: ChatMessage[] = []
  const tasks: AssistantTask[] = []
  const activityLogs: ActivityLogRecord[] = []
  const commandMemory = new Map<string, { usageCount: number; lastUsedAt: string; isFavorite: boolean }>()
  const workflows = new Map<string, WorkflowDefinition>()
  const projects: ProjectMemory[] = []
  const suggestions: PersonalizationSuggestion[] = []
  const workflowRuns: WorkflowRunRecord[] = []
  const workflowSchedules: WorkflowSchedule[] = []
  const screenAnalyses: ScreenAnalysisResult[] = []
  const agentPlans: AgentExecutionPlan[] = []
  const agentRuns: AgentRunSummary[] = []
  const aiProviderMetrics: AiProviderMetrics[] = []
  const memoryEmbeddings: MemoryEmbeddingRow[] = []
  const workspaceContexts: WorkspaceContext[] = []
  const knowledgeChunks: KnowledgeChunkRow[] = []
  const knowledgeGraphEdges: KnowledgeGraphEdge[] = []
  const observabilityEvents: ObservabilityEvent[] = []
  const proactiveNotifications: ProactiveNotification[] = []
  const learningFeedback: LearningFeedbackRecord[] = []
  const behaviorPatterns = new Map<string, BehaviorPattern>()
  const adaptiveRecommendations: AdaptiveRecommendation[] = []
  const workflowOptimizationInsights: WorkflowOptimizationInsight[] = []
  const aiKv = new Map<string, string>()
  let settingsUpdatedAt = new Date().toISOString()

  function getAiSettingsImpl(): AiProviderSettings {
    const map = aiKv
    return {
      preferredProvider:
        (map.get('preferredProvider') as AiProviderSettings['preferredProvider']) ?? 'ollama',
      offlineMode: map.get('offlineMode') === 'true',
      localModel: map.get('localModel') ?? 'llama3',
      cloudModel: map.get('cloudModel') ?? 'gpt-4o-mini',
      reasoningThreshold: Number(map.get('reasoningThreshold') ?? '220'),
      updatedAt: settingsUpdatedAt,
    }
  }

  function saveAiSettingsImpl(settings: Partial<AiProviderSettings>): AiProviderSettings {
    const current = getAiSettingsImpl()
    const next: AiProviderSettings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    }
    settingsUpdatedAt = next.updatedAt
    aiKv.set('preferredProvider', next.preferredProvider)
    aiKv.set('offlineMode', String(next.offlineMode))
    aiKv.set('localModel', next.localModel)
    aiKv.set('cloudModel', next.cloudModel)
    aiKv.set('reasoningThreshold', String(next.reasoningThreshold))
    return next
  }

  function getOverlayStateImpl(): AssistantOverlayState {
    return {
      visible: aiKv.get('overlayVisible') === 'true',
      docked: aiKv.get('overlayDocked') !== 'false',
      voiceMode: aiKv.get('overlayVoiceMode') === 'true',
      quickAutomation: aiKv.get('overlayQuickAutomation') === 'true',
      updatedAt: aiKv.get('overlayUpdatedAt') ?? new Date().toISOString(),
    }
  }

  function saveOverlayStateImpl(state: Partial<AssistantOverlayState>): AssistantOverlayState {
    const current = getOverlayStateImpl()
    const next: AssistantOverlayState = {
      ...current,
      ...state,
      updatedAt: new Date().toISOString(),
    }
    aiKv.set('overlayVisible', String(next.visible))
    aiKv.set('overlayDocked', String(next.docked))
    aiKv.set('overlayVoiceMode', String(next.voiceMode))
    aiKv.set('overlayQuickAutomation', String(next.quickAutomation))
    aiKv.set('overlayUpdatedAt', next.updatedAt)
    return next
  }

  function getShortcutBindingsImpl(): GlobalShortcutBindings {
    return {
      toggleOverlay: aiKv.get('shortcutToggleOverlay') ?? 'CommandOrControl+Space',
      toggleVoice: aiKv.get('shortcutToggleVoice') ?? 'CommandOrControl+Shift+J',
      quickAutomation: aiKv.get('shortcutQuickAutomation') ?? 'CommandOrControl+Shift+A',
    }
  }

  function saveShortcutBindingsImpl(bindings: Partial<GlobalShortcutBindings>): GlobalShortcutBindings {
    const current = getShortcutBindingsImpl()
    const next: GlobalShortcutBindings = { ...current, ...bindings }
    const now = new Date().toISOString()
    aiKv.set('shortcutToggleOverlay', next.toggleOverlay)
    aiKv.set('shortcutToggleVoice', next.toggleVoice)
    aiKv.set('shortcutQuickAutomation', next.quickAutomation)
    settingsUpdatedAt = now
    return next
  }

  function getIndexingStatusImpl(): IndexingStatus {
    const lastIndexedAt = aiKv.get('knowledge.indexing.lastIndexedAt')
    return {
      isRunning: aiKv.get('knowledge.indexing.isRunning') === 'true',
      lastIndexedAt: lastIndexedAt && lastIndexedAt.length > 0 ? lastIndexedAt : null,
      indexedChunkCount: Number(aiKv.get('knowledge.indexing.indexedChunkCount') ?? '0'),
    }
  }

  function setIndexingStatusImpl(status: Partial<IndexingStatus>): IndexingStatus {
    const current = getIndexingStatusImpl()
    const next: IndexingStatus = {
      isRunning: status.isRunning ?? current.isRunning,
      lastIndexedAt: status.lastIndexedAt ?? current.lastIndexedAt,
      indexedChunkCount: status.indexedChunkCount ?? current.indexedChunkCount,
    }
    const now = new Date().toISOString()
    aiKv.set('knowledge.indexing.isRunning', String(next.isRunning))
    aiKv.set('knowledge.indexing.lastIndexedAt', next.lastIndexedAt ?? '')
    aiKv.set('knowledge.indexing.indexedChunkCount', String(next.indexedChunkCount))
    settingsUpdatedAt = now
    return next
  }

  function upsertMemoryEmbeddingInner(entry: Omit<SemanticMemoryHit, 'score'> & { vector: number[] }): void {
    const i = memoryEmbeddings.findIndex((e) => e.id === entry.id)
    const row: MemoryEmbeddingRow = {
      id: entry.id,
      kind: entry.kind,
      content: entry.content,
      vector: entry.vector,
      createdAt: entry.createdAt,
    }
    if (i >= 0) memoryEmbeddings[i] = row
    else {
      memoryEmbeddings.unshift(row)
      if (memoryEmbeddings.length > 400) memoryEmbeddings.length = 400
    }
  }

  function indexKnowledgeChunkInner(chunk: KnowledgeChunk, vector?: number[]): void {
    const embedding = vector ?? createLocalEmbedding(chunk.content)
    const i = knowledgeChunks.findIndex((c) => c.id === chunk.id)
    const row: KnowledgeChunkRow = {
      id: chunk.id,
      sourceType: chunk.sourceType,
      sourceRef: chunk.sourceRef,
      content: chunk.content,
      metadata: chunk.metadata,
      embedding,
      indexedAt: chunk.indexedAt,
    }
    if (i >= 0) knowledgeChunks[i] = row
    else knowledgeChunks.unshift(row)
  }

  const memoryRepo: MemoryRepository = {
    addCommandLog(command, result) {
      const id = randomUUID()
      const now = new Date().toISOString()
      commandLogs.unshift({ id, command, result, createdAt: now })
      upsertMemoryEmbeddingInner({
        id,
        kind: 'command',
        content: command,
        vector: createLocalEmbedding(command),
        createdAt: now,
      })
      const existing = commandMemory.get(command)
      if (existing) {
        existing.usageCount += 1
        existing.lastUsedAt = now
      } else {
        commandMemory.set(command, { usageCount: 1, lastUsedAt: now, isFavorite: false })
      }
      return id
    },
    getRecentCommands(limit = 20) {
      return commandLogs.slice(0, limit)
    },
    addChatMessage(message) {
      const now = new Date().toISOString()
      const created: ChatMessage = {
        id: randomUUID(),
        role: message.role,
        content: message.content,
        createdAt: now,
      }
      chatMessages.unshift(created)
      upsertMemoryEmbeddingInner({
        id: created.id,
        kind: 'chat',
        content: created.content,
        vector: createLocalEmbedding(created.content),
        createdAt: created.createdAt,
      })
      return created
    },
    addTask(task) {
      const now = new Date().toISOString()
      const created: AssistantTask = {
        id: randomUUID(),
        title: task.title,
        intent: task.intent,
        target: task.target,
        status: task.status,
        createdAt: now,
        updatedAt: now,
      }
      tasks.unshift(created)
      return created
    },
    updateTaskStatus(id, status) {
      const task = tasks.find((t) => t.id === id)
      if (task) {
        task.status = status
        task.updatedAt = new Date().toISOString()
      }
    },
    getRecentTasks(limit = 30) {
      return tasks.slice(0, limit)
    },
    addActivityLog(level, message) {
      const created: ActivityLogRecord = {
        id: randomUUID(),
        level,
        message,
        createdAt: new Date().toISOString(),
      }
      activityLogs.unshift(created)
      return created
    },
    getRecentActivityLogs(limit = 100) {
      return activityLogs.slice(0, limit)
    },
    getRecentConversations(limit = 24) {
      return chatMessages.slice(0, limit)
    },
    upsertCommandMemory(command) {
      const now = new Date().toISOString()
      const existing = commandMemory.get(command)
      if (existing) {
        existing.usageCount += 1
        existing.lastUsedAt = now
      } else {
        commandMemory.set(command, { usageCount: 1, lastUsedAt: now, isFavorite: false })
      }
    },
    getCommandMemoryStats(limit = 20): CommandMemoryStats[] {
      return Array.from(commandMemory.entries())
        .map(([command, v]) => ({
          command,
          usageCount: v.usageCount,
          lastUsedAt: v.lastUsedAt,
          isFavorite: v.isFavorite,
        }))
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limit)
    },
    getWorkflows() {
      return Array.from(workflows.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    getProjects() {
      return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    getPersonalizationSuggestions(limit = 12) {
      return suggestions.slice(0, limit)
    },
    createMemoryOverview(): MemoryOverview {
      return {
        recentConversations: memoryRepo.getRecentConversations(8),
        commandStats: memoryRepo.getCommandMemoryStats(8),
        workflows: memoryRepo.getWorkflows(),
        projects: memoryRepo.getProjects(),
        suggestions: memoryRepo.getPersonalizationSuggestions(6),
      }
    },
    saveWorkflow(workflow) {
      workflows.set(workflow.id, workflow)
      upsertMemoryEmbeddingInner({
        id: workflow.id,
        kind: 'workflow',
        content: `${workflow.name} ${workflow.description}`,
        vector: createLocalEmbedding(`${workflow.name} ${workflow.description}`),
        createdAt: workflow.createdAt,
      })
    },
    addWorkflowRun(run) {
      const created: WorkflowRunRecord = { ...run, id: randomUUID() }
      workflowRuns.unshift(created)
      return created
    },
    getWorkflowRuns(limit = 40) {
      return workflowRuns.slice(0, limit)
    },
    getWorkflowSchedules() {
      return [...workflowSchedules]
    },
    updateWorkflowScheduleLastRun(id, lastRunAt) {
      const s = workflowSchedules.find((x) => x.id === id)
      if (s) s.lastRunAt = lastRunAt
    },
    generateWorkflowFromPrompt(prompt) {
      const normalized = prompt.toLowerCase()
      const now = new Date().toISOString()
      const name = normalized.includes('design')
        ? 'Design Setup'
        : normalized.includes('meeting')
          ? 'Client Meeting Setup'
          : normalized.includes('content')
            ? 'Content Creation Setup'
            : 'Development Setup'
      const steps: WorkflowDefinition['steps'] = normalized.includes('design')
        ? [
            { id: randomUUID(), type: 'open_application', payload: 'Figma', order: 1 },
            { id: randomUUID(), type: 'open_url', payload: 'https://dribbble.com', order: 2 },
          ]
        : normalized.includes('meeting')
          ? [
              { id: randomUUID(), type: 'open_application', payload: 'Chrome', order: 1 },
              { id: randomUUID(), type: 'open_url', payload: 'https://calendar.google.com', order: 2 },
            ]
          : normalized.includes('content')
            ? [
                { id: randomUUID(), type: 'open_application', payload: 'VS Code', order: 1 },
                { id: randomUUID(), type: 'open_url', payload: 'https://notion.so', order: 2 },
              ]
            : [
                { id: randomUUID(), type: 'open_application', payload: 'VS Code', order: 1 },
                { id: randomUUID(), type: 'run_terminal', payload: 'npm run dev', order: 2 },
              ]
      const workflow: WorkflowDefinition = {
        id: randomUUID(),
        name,
        description: `Generated from prompt: ${prompt}`,
        createdAt: now,
        updatedAt: now,
        steps,
      }
      memoryRepo.saveWorkflow(workflow)
      return workflow
    },
    addScreenCapture(_capture: ScreenCaptureRecord) {
      /* MVP: skip storing large base64 blobs in RAM */
    },
    addScreenAnalysis(analysis) {
      screenAnalyses.unshift(analysis)
      if (screenAnalyses.length > 200) screenAnalyses.length = 200
    },
    getRecentScreenAnalyses(limit = 24) {
      return screenAnalyses.slice(0, limit)
    },
    saveAgentPlan(plan) {
      const i = agentPlans.findIndex((p) => p.id === plan.id)
      if (i >= 0) agentPlans[i] = plan
      else agentPlans.unshift(plan)
    },
    updateAgentPlanState(id, state) {
      const plan = agentPlans.find((p) => p.id === id)
      if (plan) {
        plan.state = state
        plan.updatedAt = new Date().toISOString()
      }
    },
    getAgentPlans(limit = 30) {
      return [...agentPlans]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
    },
    addAgentRun(run) {
      const created: AgentRunSummary = { ...run, id: randomUUID() }
      agentRuns.unshift(created)
      return created
    },
    getAgentRuns(limit = 60) {
      return agentRuns.slice(0, limit)
    },
    getAiSettings() {
      return getAiSettingsImpl()
    },
    saveAiSettings(settings) {
      return saveAiSettingsImpl(settings)
    },
    addAiProviderMetric(metric) {
      aiProviderMetrics.unshift(metric)
      if (aiProviderMetrics.length > 500) aiProviderMetrics.length = 500
    },
    getAiProviderMetrics(limit = 120) {
      return aiProviderMetrics.slice(0, limit)
    },
    upsertMemoryEmbedding(entry) {
      upsertMemoryEmbeddingInner(entry)
    },
    semanticSearch(query, limit = 8) {
      const queryVector = createLocalEmbedding(query)
      return memoryEmbeddings
        .slice(0, 300)
        .map((item) => ({
          id: item.id,
          kind: item.kind,
          content: item.content,
          score: cosineSimilarity(queryVector, item.vector),
          createdAt: item.createdAt,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
    },
    getOverlayState() {
      return getOverlayStateImpl()
    },
    saveOverlayState(state) {
      return saveOverlayStateImpl(state)
    },
    getShortcutBindings() {
      return getShortcutBindingsImpl()
    },
    saveShortcutBindings(bindings) {
      return saveShortcutBindingsImpl(bindings)
    },
    addWorkspaceContext(context) {
      workspaceContexts.unshift(context)
      if (workspaceContexts.length > 200) workspaceContexts.length = 200
    },
    getLatestWorkspaceContext() {
      return workspaceContexts[0] ?? null
    },
    setSkillEnabled(skillId, enabled) {
      const now = new Date().toISOString()
      aiKv.set(`skill.${skillId}.enabled`, String(enabled))
      settingsUpdatedAt = now
    },
    getSkillEnabledStates() {
      const map = new Map<string, boolean>()
      for (const [key, value] of aiKv.entries()) {
        if (!key.startsWith('skill.') || !key.endsWith('.enabled')) continue
        const skillId = key.replace('skill.', '').replace('.enabled', '')
        map.set(skillId, value === 'true')
      }
      return map
    },
    indexKnowledgeChunk(chunk, vector) {
      indexKnowledgeChunkInner(chunk, vector)
    },
    clearKnowledgeIndex() {
      knowledgeChunks.length = 0
      knowledgeGraphEdges.length = 0
      memoryRepo.setIndexingStatus({
        isRunning: false,
        indexedChunkCount: 0,
        lastIndexedAt: null,
      })
    },
    semanticKnowledgeSearch(query, limit = 10, filter?: SemanticSearchFilter) {
      const queryVector = createLocalEmbedding(query)
      const from = filter?.fromDate ? new Date(filter.fromDate).getTime() : null
      const to = filter?.toDate ? new Date(filter.toDate).getTime() : null
      return knowledgeChunks
        .slice(0, 1200)
        .filter((item) => {
          if (filter?.sourceTypes && filter.sourceTypes.length > 0 && !filter.sourceTypes.includes(item.sourceType)) {
            return false
          }
          const ts = new Date(item.indexedAt).getTime()
          if (from !== null && ts < from) return false
          if (to !== null && ts > to) return false
          return true
        })
        .map(
          (item): SemanticSearchResult => ({
            chunk: {
              id: item.id,
              sourceType: item.sourceType,
              sourceRef: item.sourceRef,
              content: item.content,
              metadata: item.metadata,
              indexedAt: item.indexedAt,
            },
            score: cosineSimilarity(queryVector, item.embedding),
          }),
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
    },
    upsertKnowledgeGraphEdge(edge) {
      const id = `${edge.fromNodeId}:${edge.relation}:${edge.toNodeId}`
      const full: KnowledgeGraphEdge = { id, ...edge }
      const i = knowledgeGraphEdges.findIndex((e) => e.id === id)
      if (i >= 0) knowledgeGraphEdges[i] = full
      else knowledgeGraphEdges.unshift(full)
    },
    getKnowledgeGraphSnapshot(limit = 300): KnowledgeGraphSnapshot {
      const edges = knowledgeGraphEdges.slice(0, limit)
      const nodeMap = new Map<string, KnowledgeGraphNode>()
      const addNode = (nodeId: string) => {
        if (nodeMap.has(nodeId)) return
        const [type] = nodeId.split(':')
        const normalizedType: KnowledgeGraphNode['type'] =
          type === 'workflow' || type === 'command' || type === 'project' || type === 'conversation' || type === 'file'
            ? type
            : 'conversation'
        nodeMap.set(nodeId, { id: nodeId, type: normalizedType, label: nodeId.replace(`${type}:`, '') })
      }
      for (const edge of edges) {
        addNode(edge.fromNodeId)
        addNode(edge.toNodeId)
      }
      return {
        nodes: Array.from(nodeMap.values()),
        edges,
        updatedAt: new Date().toISOString(),
      }
    },
    getIndexingStatus() {
      return getIndexingStatusImpl()
    },
    setIndexingStatus(status) {
      return setIndexingStatusImpl(status)
    },
    addObservabilityEvent(event) {
      const created: ObservabilityEvent = {
        id: randomUUID(),
        ...event,
      }
      observabilityEvents.unshift(created)
      if (observabilityEvents.length > 500) observabilityEvents.length = 500
      memoryRepo.indexKnowledgeChunk({
        id: `event:${created.id}`,
        sourceType: 'activity',
        sourceRef: created.id,
        content: `${created.title} ${created.message}`,
        metadata: { eventType: created.type, severity: created.severity },
        indexedAt: created.createdAt,
      })
      return created
    },
    getRecentObservabilityEvents(limit = 120) {
      return observabilityEvents.slice(0, limit)
    },
    addProactiveNotification(notification) {
      const created: ProactiveNotification = {
        id: randomUUID(),
        level: notification.level,
        title: notification.title,
        message: notification.message,
        eventId: notification.eventId,
        actionLabel: notification.actionLabel,
        createdAt: notification.createdAt,
        readAt: notification.readAt ?? null,
      }
      proactiveNotifications.unshift(created)
      if (proactiveNotifications.length > 300) proactiveNotifications.length = 300
      return created
    },
    getRecentProactiveNotifications(limit = 80) {
      return proactiveNotifications.slice(0, limit)
    },
    markProactiveNotificationRead(notificationId) {
      const n = proactiveNotifications.find((x) => x.id === notificationId)
      if (n) n.readAt = new Date().toISOString()
    },
    getObservabilitySnapshot(): ObservabilitySnapshot {
      const events = memoryRepo.getRecentObservabilityEvents(80)
      const notifications = memoryRepo.getRecentProactiveNotifications(40)
      return {
        events,
        notifications,
        activeAlerts: notifications.filter((item) => item.readAt === null && item.level !== 'info').length,
        updatedAt: new Date().toISOString(),
      }
    },
    addLearningFeedback(feedback) {
      const created: LearningFeedbackRecord = {
        id: randomUUID(),
        ...feedback,
      }
      learningFeedback.unshift(created)
      if (learningFeedback.length > 600) learningFeedback.length = 600
      return created
    },
    getLearningFeedback(limit = 200) {
      return learningFeedback.slice(0, limit)
    },
    upsertBehaviorPattern(pattern) {
      behaviorPatterns.set(pattern.id, pattern)
    },
    getBehaviorPatterns(limit = 50) {
      return Array.from(behaviorPatterns.values())
        .sort((a, b) => b.confidence - a.confidence || b.frequency - a.frequency)
        .slice(0, limit)
    },
    addAdaptiveRecommendation(recommendation) {
      const created: AdaptiveRecommendation = {
        id: randomUUID(),
        ...recommendation,
      }
      adaptiveRecommendations.unshift(created)
      return created
    },
    getAdaptiveRecommendations(limit = 60) {
      return adaptiveRecommendations.slice(0, limit)
    },
    setRecommendationStatus(id, status) {
      const rec = adaptiveRecommendations.find((r) => r.id === id)
      if (rec) rec.status = status
      const feedbackType = status === 'accepted' ? 'recommendation_accepted' : 'recommendation_dismissed'
      memoryRepo.addLearningFeedback({
        type: feedbackType,
        source: 'overlay',
        action: 'recommendation_feedback',
        outcome: status === 'accepted' ? 'success' : 'neutral',
        score: status === 'accepted' ? 1 : 0.2,
        metadata: { recommendationId: id, status },
        createdAt: new Date().toISOString(),
      })
    },
    addWorkflowOptimizationInsight(insight) {
      const created: WorkflowOptimizationInsight = {
        id: randomUUID(),
        ...insight,
      }
      workflowOptimizationInsights.unshift(created)
      return created
    },
    getWorkflowOptimizationInsights(limit = 60) {
      return workflowOptimizationInsights.slice(0, limit)
    },
    getLearningSnapshot(): LearningSnapshot {
      const feedback = memoryRepo.getLearningFeedback(80)
      const patterns = memoryRepo.getBehaviorPatterns(20)
      const recommendations = memoryRepo.getAdaptiveRecommendations(30)
      const optimizations = memoryRepo.getWorkflowOptimizationInsights(20)
      const adaptationScore =
        feedback.length === 0
          ? 0
          : Math.round((feedback.reduce((acc, item) => acc + item.score, 0) / feedback.length) * 100)
      return {
        feedback,
        patterns,
        recommendations,
        optimizations,
        adaptationScore,
        updatedAt: new Date().toISOString(),
      }
    },
    createDefaultMemoriesIfNeeded() {
      const now = new Date().toISOString()
      if (workflows.size === 0) {
        const baseWorkflows: WorkflowDefinition[] = [
          {
            id: randomUUID(),
            name: 'Development Mode',
            description: 'Open workspace and start development services.',
            createdAt: now,
            updatedAt: now,
            steps: [
              { id: randomUUID(), type: 'open_application', payload: 'VS Code', order: 1 },
              { id: randomUUID(), type: 'run_terminal', payload: 'npm run dev', order: 2 },
            ],
          },
          {
            id: randomUUID(),
            name: 'Design Mode',
            description: 'Launch design stack and references.',
            createdAt: now,
            updatedAt: now,
            steps: [
              { id: randomUUID(), type: 'open_application', payload: 'Figma', order: 1 },
              { id: randomUUID(), type: 'open_url', payload: 'https://dribbble.com', order: 2 },
            ],
          },
        ]
        for (const workflow of baseWorkflows) {
          workflows.set(workflow.id, workflow)
        }
      }

      if (workflowSchedules.length === 0) {
        const wfList = memoryRepo.getWorkflows()
        const devWorkflow = wfList.find((item) => item.name.toLowerCase().includes('development'))
        if (devWorkflow) {
          workflowSchedules.push({
            id: randomUUID(),
            workflowId: devWorkflow.id,
            scheduleType: 'daily',
            timeOfDay: '09:00',
            dayOfWeek: null,
            runAt: null,
            isEnabled: true,
            lastRunAt: null,
            createdAt: now,
          })
        }
      }

      if (projects.length === 0) {
        projects.unshift({
          id: randomUUID(),
          name: 'JARVIS AI Desktop Assistant',
          folderPath: process.cwd(),
          startupCommands: ['npm run dev'],
          applications: ['VS Code', 'Chrome'],
          updatedAt: now,
        })
      }

      if (suggestions.length === 0) {
        suggestions.push(
          {
            id: randomUUID(),
            message: 'You often launch VS Code before running npm dev.',
            confidence: 0.82,
            createdAt: now,
          },
          {
            id: randomUUID(),
            message: 'You usually check system usage after starting workflows.',
            confidence: 0.67,
            createdAt: now,
          },
        )
      }

      if (!aiKv.has('preferredProvider')) {
        saveAiSettingsImpl({
          preferredProvider: 'ollama',
          offlineMode: false,
          localModel: 'llama3',
          cloudModel: 'gpt-4o-mini',
          reasoningThreshold: 220,
        })
        saveOverlayStateImpl({
          visible: false,
          docked: true,
          voiceMode: false,
          quickAutomation: false,
        })
        saveShortcutBindingsImpl({
          toggleOverlay: 'CommandOrControl+Space',
          toggleVoice: 'CommandOrControl+Shift+J',
          quickAutomation: 'CommandOrControl+Shift+A',
        })
      }
    },
  }

  return memoryRepo
}
