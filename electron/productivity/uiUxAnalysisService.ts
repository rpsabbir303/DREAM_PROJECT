import { randomUUID } from 'node:crypto'
import type { MemoryRepository } from '../database/memoryRepository.js'
import type { UiUxAnalysisResult, UiUxInsight } from '../../shared/interfaces/ipc.js'

export function analyzeUiUxFromMemory(memoryRepository: MemoryRepository): UiUxAnalysisResult {
  const latest = memoryRepository.getRecentScreenAnalyses(1)[0]
  if (!latest) {
    return {
      summary: 'No recent screen analysis available for UI/UX evaluation.',
      insights: [],
      createdAt: new Date().toISOString(),
    }
  }

  const insights: UiUxInsight[] = []
  if (latest.confidence < 55) {
    insights.push(insight('accessibility', 'medium', 'Low OCR confidence may indicate low contrast or small text.'))
  }
  if (latest.ocrText.length < 40) {
    insights.push(insight('typography', 'low', 'Very little readable text detected; ensure labels are present and legible.'))
  }
  if (latest.summary.length > 140) {
    insights.push(insight('layout', 'low', 'Dense content detected; consider stronger visual hierarchy for key actions.'))
  }
  insights.push(insight('consistency', 'low', 'Keep spacing and component patterns consistent across dashboard cards.'))

  return {
    summary: `UI/UX heuristic scan completed for ${latest.activeWindow?.app ?? 'current screen'}.`,
    insights: insights.slice(0, 8),
    createdAt: new Date().toISOString(),
  }
}

function insight(
  category: UiUxInsight['category'],
  severity: UiUxInsight['severity'],
  message: string,
): UiUxInsight {
  return {
    id: randomUUID(),
    category,
    severity,
    message,
  }
}
