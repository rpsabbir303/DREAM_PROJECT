import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels.js'
import type { AssistantEnvironment } from '../overlay/assistantEnvironment.js'
import type { PluginManager } from '../skills/pluginManager.js'
import type { SemanticSearchFilter } from '../../shared/interfaces/ipc.js'
import { planGoalWithOpenAi } from '../ai/agentPlanner.js'
import { AgentOrchestrator } from '../automation/agentOrchestrator.js'
import { WorkflowEngine } from '../automation/workflowEngine.js'
import { ChatEngine } from '../ai/chatEngine.js'
import { CommandEngine } from '../ai/commandEngine.js'
import type { MemoryRepository } from '../database/memoryRepository.js'
import { getSystemSnapshot } from '../system/systemMonitorService.js'
import { getActiveWindowInfo } from '../vision/activeWindowService.js'
import { analyzeCapture } from '../vision/screenAnalysisService.js'
import { captureScreen } from '../vision/screenCaptureService.js'
import { getProviderModels, getProviderStatus } from '../ai/providerRouter.js'
import { searchCommandPalette } from '../overlay/commandPaletteService.js'
import { analyzeTerminalOutput } from '../productivity/terminalIntelligenceService.js'
import { analyzeUiUxFromMemory } from '../productivity/uiUxAnalysisService.js'
import { detectProjectContext } from '../productivity/projectContextService.js'
import { generateDeveloperTasks } from '../productivity/taskGenerationService.js'
import { buildProductivityInsights } from '../productivity/productivityService.js'
import type { KnowledgeIndexingScheduler } from '../knowledge/indexingScheduler.js'
import { retrieveContext } from '../knowledge/retrievalEngine.js'
import type { MultiAgentCoordinator } from '../agents/multiAgentCoordinator.js'
import type { AdaptiveLearningOrchestrator } from '../learning/adaptiveLearningOrchestrator.js'

const chatStartInputSchema = z.object({
  streamId: z.string().uuid(),
  input: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
        createdAt: z.string(),
      }),
    )
    .max(50),
})
const workflowPromptSchema = z.string().min(6).max(500)
const agentGoalSchema = z.string().min(6).max(1000)
const voiceTranscribeInputSchema = z.object({
  audioBase64: z.string().min(12),
  mimeType: z.string().min(4).max(80),
})
const aiSettingsUpdateSchema = z.object({
  preferredProvider: z.enum(['openai', 'ollama']).optional(),
  offlineMode: z.boolean().optional(),
  localModel: z.string().min(1).max(120).optional(),
  cloudModel: z.string().min(1).max(120).optional(),
  reasoningThreshold: z.number().int().min(40).max(2000).optional(),
})

/**
 * Centralized IPC registration keeps renderer-main communication explicit and typed.
 */
export function registerIpcHandlers({
  memoryRepository,
  assistantEnvironment,
  pluginManager,
  knowledgeScheduler,
  multiAgentCoordinator,
  learningOrchestrator,
}: {
  memoryRepository: MemoryRepository
  assistantEnvironment: AssistantEnvironment
  pluginManager: PluginManager
  knowledgeScheduler: KnowledgeIndexingScheduler
  multiAgentCoordinator: MultiAgentCoordinator
  learningOrchestrator: AdaptiveLearningOrchestrator
}) {
  const commandEngine = new CommandEngine(memoryRepository)
  const chatEngine = new ChatEngine(memoryRepository, () => pluginManager.getCapabilityPromptSnippet())
  const workflowEngine = new WorkflowEngine(memoryRepository)
  const agentOrchestrator = new AgentOrchestrator(memoryRepository)
  ipcMain.handle(IPC_CHANNELS.systemSnapshot, async () => {
    return getSystemSnapshot()
  })
  const terminalInputSchema = z.string().min(1).max(400000)
  const devTaskPromptSchema = z.string().min(6).max(3000)

  ipcMain.handle(IPC_CHANNELS.parseIntent, async (_event, userInput: string) => {
    return commandEngine.parse(userInput)
  })
  ipcMain.handle(IPC_CHANNELS.agentPlanGoal, async (_event, goal: string) => {
    const validatedGoal = agentGoalSchema.parse(goal)
    const plan = await planGoalWithOpenAi(validatedGoal)
    memoryRepository.saveAgentPlan(plan)
    memoryRepository.updateAgentPlanState(plan.id, 'planning')
    return plan
  })
  ipcMain.handle(
    IPC_CHANNELS.agentExecutePlan,
    async (_event, payload: { planId: string; allowRiskyActions?: boolean }) => {
      return agentOrchestrator.executePlan(payload.planId, {
        allowRiskyActions: payload.allowRiskyActions ?? false,
      })
    },
  )
  ipcMain.handle(IPC_CHANNELS.agentPlans, async () => {
    return memoryRepository.getAgentPlans(40)
  })
  ipcMain.handle(IPC_CHANNELS.agentRuns, async () => {
    return memoryRepository.getAgentRuns(80)
  })
  ipcMain.handle(IPC_CHANNELS.aiProviderSettingsGet, async () => {
    return memoryRepository.getAiSettings()
  })
  ipcMain.handle(IPC_CHANNELS.aiProviderSettingsSet, async (_event, payload: unknown) => {
    const parsed = aiSettingsUpdateSchema.parse(payload)
    return memoryRepository.saveAiSettings(parsed)
  })
  ipcMain.handle(IPC_CHANNELS.aiProviderModels, async () => {
    const settings = memoryRepository.getAiSettings()
    return getProviderModels(settings)
  })
  ipcMain.handle(IPC_CHANNELS.aiProviderStatus, async () => {
    return getProviderStatus()
  })
  ipcMain.handle(IPC_CHANNELS.aiProviderMetrics, async () => {
    return memoryRepository.getAiProviderMetrics(80)
  })
  ipcMain.handle(IPC_CHANNELS.memorySemanticSearch, async (_event, query: string) => {
    return memoryRepository.semanticSearch(query, 8)
  })
  ipcMain.handle(IPC_CHANNELS.overlayGetState, async () => {
    return assistantEnvironment.getOverlayState()
  })
  ipcMain.handle(IPC_CHANNELS.overlaySetVisible, async (_event, visible: boolean) => {
    return assistantEnvironment.setOverlayVisible(visible)
  })
  ipcMain.handle(IPC_CHANNELS.overlaySetDocked, async (_event, docked: boolean) => {
    return assistantEnvironment.setOverlayDocked(docked)
  })
  ipcMain.handle(IPC_CHANNELS.overlaySetVoiceMode, async (_event, voiceMode: boolean) => {
    return assistantEnvironment.setOverlayVoiceMode(voiceMode)
  })
  ipcMain.handle(IPC_CHANNELS.overlaySetQuickAutomation, async (_event, enabled: boolean) => {
    return assistantEnvironment.setOverlayQuickAutomation(enabled)
  })
  ipcMain.handle(IPC_CHANNELS.overlayGetShortcuts, async () => {
    return assistantEnvironment.getShortcutBindings()
  })
  ipcMain.handle(IPC_CHANNELS.overlaySetShortcuts, async (_event, bindings) => {
    return assistantEnvironment.setShortcutBindings(bindings)
  })
  ipcMain.handle(IPC_CHANNELS.overlayWorkspaceContext, async () => {
    return assistantEnvironment.getWorkspaceContext()
  })
  ipcMain.handle(IPC_CHANNELS.overlayCommandPaletteSearch, async (_event, query: string) => {
    return searchCommandPalette(memoryRepository, query)
  })
  ipcMain.handle(IPC_CHANNELS.productivityProjectContext, async () => {
    return detectProjectContext(process.cwd())
  })
  ipcMain.handle(IPC_CHANNELS.productivityAnalyzeTerminal, async (_event, text: string) => {
    return analyzeTerminalOutput(terminalInputSchema.parse(text))
  })
  ipcMain.handle(IPC_CHANNELS.productivityAnalyzeUiUx, async () => {
    return analyzeUiUxFromMemory(memoryRepository)
  })
  ipcMain.handle(IPC_CHANNELS.productivityGenerateTasks, async (_event, prompt: string) => {
    return generateDeveloperTasks(devTaskPromptSchema.parse(prompt))
  })
  ipcMain.handle(IPC_CHANNELS.productivityInsights, async () => {
    return buildProductivityInsights(memoryRepository, process.cwd())
  })
  ipcMain.handle(IPC_CHANNELS.skillList, async () => {
    return pluginManager.listSkills()
  })
  ipcMain.handle(IPC_CHANNELS.skillSetEnabled, async (_event, payload: { skillId: string; enabled: boolean }) => {
    return pluginManager.setSkillEnabled(payload.skillId, payload.enabled)
  })
  ipcMain.handle(IPC_CHANNELS.skillCapabilityOverview, async () => {
    return pluginManager.getCapabilityOverview()
  })
  ipcMain.handle(
    IPC_CHANNELS.skillToolsExecute,
    async (_event, payload: { skillId: string; toolCommand: string; input?: string }) => {
      return pluginManager.executeTool(payload)
    },
  )
  ipcMain.handle(IPC_CHANNELS.knowledgeReindex, async () => {
    return knowledgeScheduler.reindex()
  })
  ipcMain.handle(IPC_CHANNELS.knowledgeIndexingStatus, async () => {
    return memoryRepository.getIndexingStatus()
  })
  ipcMain.handle(
    IPC_CHANNELS.knowledgeSemanticSearch,
    async (_event, payload: { query: string; limit?: number; filter?: SemanticSearchFilter }) => {
      return memoryRepository.semanticKnowledgeSearch(payload.query, payload.limit ?? 10, payload.filter)
    },
  )
  ipcMain.handle(IPC_CHANNELS.knowledgeGraph, async () => {
    return memoryRepository.getKnowledgeGraphSnapshot(300)
  })
  ipcMain.handle(IPC_CHANNELS.knowledgeContextRetrieve, async (_event, query: string) => {
    return retrieveContext(memoryRepository, query)
  })
  ipcMain.handle(IPC_CHANNELS.multiAgentRun, async (_event, goal: string) => {
    return multiAgentCoordinator.run(goal)
  })
  ipcMain.handle(IPC_CHANNELS.multiAgentSessions, async () => {
    return multiAgentCoordinator.listSessions()
  })
  ipcMain.handle(IPC_CHANNELS.multiAgentPerformance, async () => {
    return multiAgentCoordinator.getPerformanceMetrics()
  })
  ipcMain.handle(IPC_CHANNELS.observabilityEvents, async () => {
    return memoryRepository.getRecentObservabilityEvents(160)
  })
  ipcMain.handle(IPC_CHANNELS.observabilityNotifications, async () => {
    return memoryRepository.getRecentProactiveNotifications(100)
  })
  ipcMain.handle(IPC_CHANNELS.observabilitySnapshot, async () => {
    return memoryRepository.getObservabilitySnapshot()
  })
  ipcMain.handle(IPC_CHANNELS.observabilityMarkNotificationRead, async (_event, notificationId: string) => {
    memoryRepository.markProactiveNotificationRead(notificationId)
    return { ok: true as const }
  })
  ipcMain.handle(IPC_CHANNELS.learningFeedback, async () => {
    return memoryRepository.getLearningFeedback(200)
  })
  ipcMain.handle(IPC_CHANNELS.learningPatterns, async () => {
    return memoryRepository.getBehaviorPatterns(80)
  })
  ipcMain.handle(IPC_CHANNELS.learningRecommendations, async () => {
    return memoryRepository.getAdaptiveRecommendations(80)
  })
  ipcMain.handle(IPC_CHANNELS.learningOptimizations, async () => {
    return memoryRepository.getWorkflowOptimizationInsights(80)
  })
  ipcMain.handle(IPC_CHANNELS.learningSnapshot, async () => {
    return memoryRepository.getLearningSnapshot()
  })
  ipcMain.handle(IPC_CHANNELS.learningRefresh, async () => {
    return learningOrchestrator.refresh()
  })
  ipcMain.handle(
    IPC_CHANNELS.learningSetRecommendationStatus,
    async (_event, payload: { recommendationId: string; status: 'accepted' | 'dismissed' }) => {
      memoryRepository.setRecommendationStatus(payload.recommendationId, payload.status)
      return { ok: true as const }
    },
  )

  ipcMain.handle(IPC_CHANNELS.executeIntent, async (_event, userInput: string) => {
    return commandEngine.handle(userInput)
  })

  ipcMain.handle(IPC_CHANNELS.memoryRecentCommands, async () => {
    return memoryRepository.getRecentCommands()
  })
  ipcMain.handle(IPC_CHANNELS.memoryOverview, async () => {
    return memoryRepository.createMemoryOverview()
  })
  ipcMain.handle(IPC_CHANNELS.memoryCommandStats, async () => {
    return memoryRepository.getCommandMemoryStats(20)
  })
  ipcMain.handle(IPC_CHANNELS.memoryWorkflows, async () => {
    return memoryRepository.getWorkflows()
  })
  ipcMain.handle(IPC_CHANNELS.memoryProjects, async () => {
    return memoryRepository.getProjects()
  })
  ipcMain.handle(IPC_CHANNELS.memorySuggestions, async () => {
    return memoryRepository.getPersonalizationSuggestions(12)
  })
  ipcMain.handle(IPC_CHANNELS.workflowExecute, async (_event, workflowId: string) => {
    return workflowEngine.executeWorkflow(workflowId)
  })
  ipcMain.handle(IPC_CHANNELS.workflowSchedules, async () => {
    return memoryRepository.getWorkflowSchedules()
  })
  ipcMain.handle(IPC_CHANNELS.workflowRuns, async () => {
    return memoryRepository.getWorkflowRuns(60)
  })
  ipcMain.handle(IPC_CHANNELS.workflowGenerate, async (_event, prompt: string) => {
    const validatedPrompt = workflowPromptSchema.parse(prompt)
    return memoryRepository.generateWorkflowFromPrompt(validatedPrompt)
  })

  ipcMain.handle(IPC_CHANNELS.executionRecentLogs, async () => {
    return memoryRepository.getRecentActivityLogs(120)
  })

  ipcMain.handle(IPC_CHANNELS.executionRecentTasks, async () => {
    return memoryRepository.getRecentTasks(40)
  })

  ipcMain.handle(IPC_CHANNELS.aiChatStartStream, async (event, payload) => {
    const parsed = chatStartInputSchema.parse(payload)
    void chatEngine.startStream(parsed, event.sender)
    return { accepted: true as const }
  })

  ipcMain.handle(IPC_CHANNELS.aiChatCancelStream, async (_event, streamId: string) => {
    return { cancelled: chatEngine.cancelStream(streamId) }
  })

  ipcMain.handle(IPC_CHANNELS.voiceTranscribe, async (_event, payload) => {
    const parsed = voiceTranscribeInputSchema.parse(payload)
    const { transcribeAudioWithWhisper } = await import('../ai/providers/whisperProvider.js')
    return transcribeAudioWithWhisper(parsed)
  })

  ipcMain.handle(IPC_CHANNELS.screenCapture, async (_event, source?: 'full_screen' | 'active_window') => {
    return captureScreen(source ?? 'full_screen')
  })
  ipcMain.handle(IPC_CHANNELS.screenActiveWindow, async () => {
    return getActiveWindowInfo()
  })
  ipcMain.handle(IPC_CHANNELS.screenAnalyze, async () => {
    const capture = await captureScreen('full_screen')
    return analyzeCapture(capture, memoryRepository)
  })
  ipcMain.handle(IPC_CHANNELS.screenHistory, async () => {
    return memoryRepository.getRecentScreenAnalyses(24)
  })
}
