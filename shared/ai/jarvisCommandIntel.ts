/**
 * Lightweight command intelligence types (MVP — no orchestration stack).
 * Used by the main process to gate tools and enrich system prompts.
 */

/** How unclear the actionable target is (drives clarify-before-execute). */
export type CommandAmbiguity = 'low' | 'medium' | 'high'

/** User-input safety triage — blocked requests must not invoke desktop tools. */
export type CommandRiskLevel = 'none' | 'low' | 'blocked'

/**
 * Whether the OpenAI tool surface is active for this turn.
 * - tools_enabled: normal tool loop
 * - tools_disabled_clarify: chat-only; ask a focused question instead of guessing
 * - tools_disabled_refuse: chat-only; refuse safely with a short explanation
 */
export type ToolRuntimeMode = 'tools_enabled' | 'tools_disabled_clarify' | 'tools_disabled_refuse'

/** Output of the deterministic decision pass (runs before the LLM). */
export interface CommandIntelDecision {
  mode: ToolRuntimeMode
  /** Extra system instructions for this turn (appended to JARVIS system prompt). */
  systemAddendum: string
  /** Short human-readable label for logs / UI (why tools are on or off). */
  decisionSummary: string
}
