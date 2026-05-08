import type { AdaptiveRecommendation, BehaviorPattern } from '../../shared/interfaces/ipc.js'

export function buildRecommendations(patterns: BehaviorPattern[]): AdaptiveRecommendation[] {
  const now = new Date().toISOString()
  return patterns
    .filter((pattern) => pattern.confidence >= 0.55)
    .slice(0, 12)
    .map((pattern) => ({
      id: `rec:${pattern.id}`,
      title: `Optimize ${pattern.name}`,
      message: `You frequently run ${pattern.name}. Create a one-click automation for this routine.`,
      category: pattern.category === 'workflow' ? 'workflow' : 'automation',
      confidence: pattern.confidence,
      impactScore: Number(Math.min(1, pattern.frequency / 10 + pattern.confidence / 2).toFixed(2)),
      sourcePatternId: pattern.id,
      status: 'active',
      createdAt: now,
    }))
}
