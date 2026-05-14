import { create } from 'zustand'
import type {
  AdaptiveRecommendation,
  BehaviorPattern,
  LearningFeedbackRecord,
  LearningSnapshot,
  WorkflowOptimizationInsight,
} from '@shared/interfaces/ipc'
import { desktopClient } from '@/services/desktop/desktopClient'

interface LearningStore {
  feedback: LearningFeedbackRecord[]
  patterns: BehaviorPattern[]
  recommendations: AdaptiveRecommendation[]
  optimizations: WorkflowOptimizationInsight[]
  snapshot: LearningSnapshot | null
  isLoading: boolean
  error: string | null
  loadLearning: () => Promise<void>
  refreshLearning: () => Promise<void>
  setRecommendationStatus: (recommendationId: string, status: 'accepted' | 'dismissed') => Promise<void>
}

export const useLearningStore = create<LearningStore>((set, get) => ({
  feedback: [],
  patterns: [],
  recommendations: [],
  optimizations: [],
  snapshot: null,
  isLoading: false,
  error: null,
  loadLearning: async () => {
    set({ isLoading: true, error: null })
    try {
      const [feedback, patterns, recommendations, optimizations, snapshot] = await Promise.all([
        desktopClient.getLearningFeedback(),
        desktopClient.getLearningPatterns(),
        desktopClient.getLearningRecommendations(),
        desktopClient.getLearningOptimizations(),
        desktopClient.getLearningSnapshot(),
      ])
      set({
        feedback,
        patterns,
        recommendations,
        optimizations,
        snapshot,
        isLoading: false,
      })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load adaptive learning data.',
      })
    }
  },
  refreshLearning: async () => {
    await desktopClient.refreshLearning()
    await get().loadLearning()
  },
  setRecommendationStatus: async (recommendationId, status) => {
    await desktopClient.setLearningRecommendationStatus({ recommendationId, status })
    await get().loadLearning()
  },
}))
