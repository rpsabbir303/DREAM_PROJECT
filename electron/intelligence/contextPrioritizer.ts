import type { FusedContextChunk, MultimodalFusionPreferences, PrioritizedContextSlice } from '../../shared/multimodal/types.js'
import { MultimodalIntelligenceError } from './multimodalErrors.js'

const MODALITY_WEIGHT: Record<FusedContextChunk['kind'], number> = {
  client_terminal: 1.35,
  screen: 1.25,
  observability: 1.15,
  semantic_memory: 1.1,
  knowledge_index: 1.05,
  productivity: 1.05,
  workspace: 1.0,
  workflow: 0.95,
  task: 0.9,
  activity_log: 0.85,
  command_history: 0.75,
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9_./:+]+/g)
      .filter((t) => t.length > 2),
  )
}

function overlapScore(queryTokens: Set<string>, content: string): number {
  let score = 0
  const contentTokens = tokenize(content)
  for (const t of queryTokens) {
    if (contentTokens.has(t)) score += 1
  }
  return score
}

function severityBoost(chunk: FusedContextChunk): number {
  if (chunk.weightHints.severity === 'error') return 3
  if (chunk.weightHints.severity === 'warning') return 1.5
  return 0
}

/** Rough char budget from approximate token target (heuristic). */
export function charsBudgetFromTokens(maxApproxTokens: number): number {
  return Math.max(2000, maxApproxTokens * 4)
}

/**
 * Scores and packs context slices to respect a soft character budget.
 */
export function prioritizeContextChunks(
  chunks: FusedContextChunk[],
  userInput: string,
  preferences: MultimodalFusionPreferences,
): PrioritizedContextSlice[] {
  try {
    const budget = charsBudgetFromTokens(preferences.maxApproxTokens)
    const queryTokens = tokenize(userInput)
    const scored = chunks.map((chunk) => {
      const base = MODALITY_WEIGHT[chunk.kind] ?? 1
      const overlap = overlapScore(queryTokens, `${chunk.title}\n${chunk.content}`)
      const pinned = chunk.weightHints.pinned ? 4 : 0
      const severity = severityBoost(chunk)
      const score = base * 2 + overlap + pinned + severity
      return { chunk, score }
    })

    scored.sort((a, b) => b.score - a.score)

    const result: PrioritizedContextSlice[] = []
    let used = 0
    for (const item of scored) {
      const remaining = budget - used
      if (remaining < 120) break
      let text = item.chunk.content
      let truncated = false
      if (text.length > remaining) {
        text = `${text.slice(0, Math.max(0, remaining - 40))}\n… [trimmed for context window]`
        truncated = true
      }
      used += text.length + item.chunk.title.length
      result.push({
        chunk: { ...item.chunk, content: text },
        score: item.score,
        truncated,
      })
    }
    return result
  } catch (cause) {
    throw new MultimodalIntelligenceError('prioritization', 'Failed to prioritize fused context', cause)
  }
}
