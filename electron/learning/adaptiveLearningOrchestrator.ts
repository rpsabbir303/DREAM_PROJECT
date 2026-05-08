import type { LearningSnapshot } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'
import { detectBehaviorPatterns } from './patternRecognitionEngine.js'
import { buildRecommendations } from './recommendationEngine.js'
import { buildWorkflowOptimizationInsights } from './workflowOptimizationEngine.js'

const REFRESH_INTERVAL_MS = 45_000

export class AdaptiveLearningOrchestrator {
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly memoryRepository: MemoryRepository) {}

  start() {
    if (this.timer) return
    void this.refresh()
    this.timer = setInterval(() => {
      void this.refresh()
    }, REFRESH_INTERVAL_MS)
  }

  stop() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  refresh(): LearningSnapshot {
    const feedback = this.memoryRepository.getLearningFeedback(400)
    const patterns = detectBehaviorPatterns(feedback)
    for (const pattern of patterns) {
      this.memoryRepository.upsertBehaviorPattern(pattern)
    }

    const recommendations = buildRecommendations(patterns)
    const existing = this.memoryRepository.getAdaptiveRecommendations(200)
    const existingIds = new Set(existing.map((item) => item.id))
    for (const recommendation of recommendations) {
      if (!existingIds.has(recommendation.id)) {
        this.memoryRepository.addAdaptiveRecommendation(recommendation)
      }
    }

    const optimizations = buildWorkflowOptimizationInsights(this.memoryRepository.getWorkflowRuns(200))
    const knownOptimizationIds = new Set(
      this.memoryRepository.getWorkflowOptimizationInsights(120).map((item) => item.id),
    )
    for (const insight of optimizations) {
      if (!knownOptimizationIds.has(insight.id)) {
        this.memoryRepository.addWorkflowOptimizationInsight(insight)
      }
    }

    return this.memoryRepository.getLearningSnapshot()
  }
}
