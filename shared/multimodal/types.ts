/**
 * Multimodal intelligence types — shared between Electron main and renderer.
 * Describes fusion preferences, orchestration traces, and synchronization snapshots.
 */

/** High-level modalities the fusion engine may ingest (used for transparency + scoring). */
export type MultimodalChunkKind =
  | 'workspace'
  | 'screen'
  | 'semantic_memory'
  | 'knowledge_index'
  | 'observability'
  | 'workflow'
  | 'activity_log'
  | 'task'
  | 'productivity'
  | 'client_terminal'
  | 'command_history'

/** User-controlled fusion: conservative defaults; callers may widen context explicitly. */
export interface MultimodalFusionPreferences {
  /** Include vector semantic memory hits (SQLite-backed). */
  includeSemanticMemory: boolean
  /** Include indexed knowledge chunks from the semantic knowledge engine. */
  includeKnowledgeIndex: boolean
  /**
   * Screen + OCR context policy.
   * - `auto`: attach when the user message suggests UI/screen/terminal-on-screen topics.
   * - `always`: always attach the latest analysis (bounded size).
   * - `never`: skip screen-derived text.
   */
  includeScreenAnalyses: 'auto' | 'always' | 'never'
  /** Recent observability events (may contain paths or titles — off by default). */
  includeObservability: boolean
  /** Recent structured activity logs from the execution subsystem. */
  includeActivityLogs: boolean
  /** Workflow definitions + recent run summaries. */
  includeWorkflowContext: boolean
  /** Recent assistant tasks / automation queue snapshot. */
  includeExecutionTasks: boolean
  /** Latest overlay workspace snapshot (foreground app/title). */
  includeWorkspace: boolean
  /** Async productivity digest (project + heuristics from logs/screen). */
  includeProductivity: boolean
  /** Recent shell commands from memory (off by default — can be noisy or sensitive). */
  includeCommandHistory: boolean
  /** Rough token budget for fused context after prioritization (heuristic: chars/4). */
  maxApproxTokens: number
  /**
   * When true, a compressed session summary is indexed into the knowledge store after a successful reply.
   * Never stores raw screenshots — text summary only.
   */
  persistSessionToKnowledge: boolean
}

export const DEFAULT_MULTIMODAL_FUSION_PREFERENCES: MultimodalFusionPreferences = {
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
}

/** Optional payload sent with chat streams — all fields are user/renderer initiated. */
export interface MultimodalStreamPayload {
  preferences?: Partial<MultimodalFusionPreferences>
  /**
   * Optional terminal excerpt supplied by the user or developer tools — never auto-filled by the engine.
   * Keeps terminal content under explicit user/renderer control.
   */
  clientTerminalSnippet?: string
}

/** One normalized slice of fused context prior to prioritization. */
export interface FusedContextChunk {
  id: string
  kind: MultimodalChunkKind
  title: string
  content: string
  /** ISO timestamp when this modality was captured, if known. */
  createdAt?: string
  /** Opaque hints for prioritizer (e.g. severity). */
  weightHints: {
    severity?: 'info' | 'warning' | 'error'
    pinned?: boolean
  }
}

/** Output of the prioritizer: ordered, possibly truncated list. */
export interface PrioritizedContextSlice {
  chunk: FusedContextChunk
  score: number
  /** True if the slice was truncated to satisfy the budget. */
  truncated: boolean
}

/** Cross-links inferred without sending images — text-only reasoning aids. */
export interface CrossModalReasoningHint {
  id: string
  summary: string
  relatedModalities: MultimodalChunkKind[]
}

/** Non-sensitive transparency payload streamed to the renderer. */
export interface MultimodalTracePayload {
  modalitiesIncluded: MultimodalChunkKind[]
  chunkCount: number
  keptAfterPrioritization: number
  trimmedCount: number
  approxTokensBudget: number
  approxTokensUsed: number
  crossModalHintCount: number
  /** Short summaries of cross-modal hints (no raw telemetry). */
  crossModalSummaries: string[]
  /** Short privacy notes (e.g. “observability omitted by preference”). */
  privacyNotes: string[]
}

/** Lightweight live sync snapshot for stores / future indicators. */
export interface ContextSyncSnapshot {
  updatedAt: string
  hasWorkspace: boolean
  lastScreenAnalysisAt: string | null
  recentObservabilityErrors: number
  activeWorkflowCount: number
  recentFailedWorkflowRuns: number
}

export interface MultimodalReasoningState {
  lastCrossModalHints: CrossModalReasoningHint[]
  lastTrace: MultimodalTracePayload | null
  lastError: string | null
}
