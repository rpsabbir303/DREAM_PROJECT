/**
 * Multimodal intelligence types — shared between Electron main and renderer.
 * Describes fusion preferences, orchestration traces, and synchronization snapshots.
 */
export const DEFAULT_MULTIMODAL_FUSION_PREFERENCES = {
    includeSemanticMemory: true,
    includeKnowledgeIndex: true,
    includeScreenAnalyses: 'auto',
    includeObservability: false,
    includeActivityLogs: false,
    includeWorkflowContext: true,
    includeExecutionTasks: true,
    includeWorkspace: true,
    includeProductivity: true,
    includeCommandHistory: false,
    maxApproxTokens: 6000,
    persistSessionToKnowledge: false,
};
