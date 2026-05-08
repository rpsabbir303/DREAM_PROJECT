import type { BehaviorPattern, LearningFeedbackRecord } from '../../shared/interfaces/ipc.js'

export function detectBehaviorPatterns(feedback: LearningFeedbackRecord[]): BehaviorPattern[] {
  const grouped = new Map<string, LearningFeedbackRecord[]>()
  for (const item of feedback) {
    const key = `${item.source}:${item.action}`
    const items = grouped.get(key) ?? []
    items.push(item)
    grouped.set(key, items)
  }

  return Array.from(grouped.entries())
    .filter(([, items]) => items.length >= 2)
    .map(([key, items], index) => {
      const [source, action] = key.split(':')
      const successCount = items.filter((item) => item.outcome === 'success').length
      const confidence = Math.min(0.98, successCount / items.length + Math.min(items.length / 20, 0.2))
      return {
        id: `pattern:${source}:${action}`,
        name: `${source} ${action}`.replace(/_/g, ' '),
        description: `Detected repeated ${action.replace(/_/g, ' ')} behavior from ${source}.`,
        category: index % 2 === 0 ? 'sequence' : 'routine',
        confidence: Number(confidence.toFixed(2)),
        frequency: items.length,
        lastSeenAt: items[0]?.createdAt ?? new Date().toISOString(),
        relatedActions: Array.from(new Set(items.map((item) => item.action))).slice(0, 6),
      } satisfies BehaviorPattern
    })
    .sort((a, b) => b.confidence - a.confidence || b.frequency - a.frequency)
    .slice(0, 20)
}
