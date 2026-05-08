import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels.js'
import type { JarvisDesktopApi } from '../../shared/types/index.js'

const api: JarvisDesktopApi = {
  system: {
    getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.systemSnapshot),
  },
  ai: {
    parseIntent: (input) => ipcRenderer.invoke(IPC_CHANNELS.parseIntent, input),
    executeIntent: (input) => ipcRenderer.invoke(IPC_CHANNELS.executeIntent, input),
    planGoal: (goal) => ipcRenderer.invoke(IPC_CHANNELS.agentPlanGoal, goal),
    executePlan: (payload) => ipcRenderer.invoke(IPC_CHANNELS.agentExecutePlan, payload),
    getPlans: () => ipcRenderer.invoke(IPC_CHANNELS.agentPlans),
    getRuns: () => ipcRenderer.invoke(IPC_CHANNELS.agentRuns),
    getProviderSettings: () => ipcRenderer.invoke(IPC_CHANNELS.aiProviderSettingsGet),
    updateProviderSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.aiProviderSettingsSet, settings),
    getProviderModels: () => ipcRenderer.invoke(IPC_CHANNELS.aiProviderModels),
    getProviderStatus: () => ipcRenderer.invoke(IPC_CHANNELS.aiProviderStatus),
    getProviderMetrics: () => ipcRenderer.invoke(IPC_CHANNELS.aiProviderMetrics),
    searchMemorySemantically: (query) => ipcRenderer.invoke(IPC_CHANNELS.memorySemanticSearch, query),
    getOverlayState: () => ipcRenderer.invoke(IPC_CHANNELS.overlayGetState),
    setOverlayVisible: (visible) => ipcRenderer.invoke(IPC_CHANNELS.overlaySetVisible, visible),
    setOverlayDocked: (docked) => ipcRenderer.invoke(IPC_CHANNELS.overlaySetDocked, docked),
    setOverlayVoiceMode: (voiceMode) => ipcRenderer.invoke(IPC_CHANNELS.overlaySetVoiceMode, voiceMode),
    setOverlayQuickAutomation: (enabled) =>
      ipcRenderer.invoke(IPC_CHANNELS.overlaySetQuickAutomation, enabled),
    getShortcutBindings: () => ipcRenderer.invoke(IPC_CHANNELS.overlayGetShortcuts),
    setShortcutBindings: (bindings) => ipcRenderer.invoke(IPC_CHANNELS.overlaySetShortcuts, bindings),
    getWorkspaceContext: () => ipcRenderer.invoke(IPC_CHANNELS.overlayWorkspaceContext),
    searchCommandPalette: (query) => ipcRenderer.invoke(IPC_CHANNELS.overlayCommandPaletteSearch, query),
    getProjectContext: () => ipcRenderer.invoke(IPC_CHANNELS.productivityProjectContext),
    analyzeTerminalOutput: (text) => ipcRenderer.invoke(IPC_CHANNELS.productivityAnalyzeTerminal, text),
    analyzeUiUx: () => ipcRenderer.invoke(IPC_CHANNELS.productivityAnalyzeUiUx),
    generateDevTasks: (prompt) => ipcRenderer.invoke(IPC_CHANNELS.productivityGenerateTasks, prompt),
    getProductivityInsights: () => ipcRenderer.invoke(IPC_CHANNELS.productivityInsights),
    listSkills: () => ipcRenderer.invoke(IPC_CHANNELS.skillList),
    setSkillEnabled: (payload) => ipcRenderer.invoke(IPC_CHANNELS.skillSetEnabled, payload),
    getSkillCapabilityOverview: () => ipcRenderer.invoke(IPC_CHANNELS.skillCapabilityOverview),
    executeSkillTool: (payload) => ipcRenderer.invoke(IPC_CHANNELS.skillToolsExecute, payload),
    reindexKnowledge: () => ipcRenderer.invoke(IPC_CHANNELS.knowledgeReindex),
    getIndexingStatus: () => ipcRenderer.invoke(IPC_CHANNELS.knowledgeIndexingStatus),
    semanticKnowledgeSearch: (payload) => ipcRenderer.invoke(IPC_CHANNELS.knowledgeSemanticSearch, payload),
    getKnowledgeGraph: () => ipcRenderer.invoke(IPC_CHANNELS.knowledgeGraph),
    retrieveContext: (query) => ipcRenderer.invoke(IPC_CHANNELS.knowledgeContextRetrieve, query),
    runMultiAgentTask: (goal) => ipcRenderer.invoke(IPC_CHANNELS.multiAgentRun, goal),
    getMultiAgentSessions: () => ipcRenderer.invoke(IPC_CHANNELS.multiAgentSessions),
    getMultiAgentPerformance: () => ipcRenderer.invoke(IPC_CHANNELS.multiAgentPerformance),
    getObservabilityEvents: () => ipcRenderer.invoke(IPC_CHANNELS.observabilityEvents),
    getObservabilityNotifications: () => ipcRenderer.invoke(IPC_CHANNELS.observabilityNotifications),
    getObservabilitySnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.observabilitySnapshot),
    markObservabilityNotificationRead: (notificationId) =>
      ipcRenderer.invoke(IPC_CHANNELS.observabilityMarkNotificationRead, notificationId),
    getLearningFeedback: () => ipcRenderer.invoke(IPC_CHANNELS.learningFeedback),
    getLearningPatterns: () => ipcRenderer.invoke(IPC_CHANNELS.learningPatterns),
    getLearningRecommendations: () => ipcRenderer.invoke(IPC_CHANNELS.learningRecommendations),
    getLearningOptimizations: () => ipcRenderer.invoke(IPC_CHANNELS.learningOptimizations),
    getLearningSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.learningSnapshot),
    refreshLearning: () => ipcRenderer.invoke(IPC_CHANNELS.learningRefresh),
    setLearningRecommendationStatus: (payload) =>
      ipcRenderer.invoke(IPC_CHANNELS.learningSetRecommendationStatus, payload),
    startChatStream: (input) => ipcRenderer.invoke(IPC_CHANNELS.aiChatStartStream, input),
    cancelChatStream: (streamId) => ipcRenderer.invoke(IPC_CHANNELS.aiChatCancelStream, streamId),
    onChatStreamEvent: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        listener(payload as Parameters<typeof listener>[0])
      }
      ipcRenderer.on(IPC_CHANNELS.aiChatStreamEvent, handler)
      return () => ipcRenderer.off(IPC_CHANNELS.aiChatStreamEvent, handler)
    },
  },
  memory: {
    getRecentCommands: () => ipcRenderer.invoke(IPC_CHANNELS.memoryRecentCommands),
    getOverview: () => ipcRenderer.invoke(IPC_CHANNELS.memoryOverview),
    getCommandStats: () => ipcRenderer.invoke(IPC_CHANNELS.memoryCommandStats),
    getWorkflows: () => ipcRenderer.invoke(IPC_CHANNELS.memoryWorkflows),
    getProjects: () => ipcRenderer.invoke(IPC_CHANNELS.memoryProjects),
    getSuggestions: () => ipcRenderer.invoke(IPC_CHANNELS.memorySuggestions),
    executeWorkflow: (workflowId) => ipcRenderer.invoke(IPC_CHANNELS.workflowExecute, workflowId),
    getWorkflowSchedules: () => ipcRenderer.invoke(IPC_CHANNELS.workflowSchedules),
    getWorkflowRuns: () => ipcRenderer.invoke(IPC_CHANNELS.workflowRuns),
    generateWorkflowFromPrompt: (prompt) => ipcRenderer.invoke(IPC_CHANNELS.workflowGenerate, prompt),
  },
  execution: {
    getRecentLogs: () => ipcRenderer.invoke(IPC_CHANNELS.executionRecentLogs),
    getRecentTasks: () => ipcRenderer.invoke(IPC_CHANNELS.executionRecentTasks),
  },
  voice: {
    transcribe: (input) => ipcRenderer.invoke(IPC_CHANNELS.voiceTranscribe, input),
  },
  screen: {
    capture: (source) => ipcRenderer.invoke(IPC_CHANNELS.screenCapture, source),
    getActiveWindow: () => ipcRenderer.invoke(IPC_CHANNELS.screenActiveWindow),
    analyzeLatest: () => ipcRenderer.invoke(IPC_CHANNELS.screenAnalyze),
    getHistory: () => ipcRenderer.invoke(IPC_CHANNELS.screenHistory),
  },
}

contextBridge.exposeInMainWorld('jarvis', api)
