import type { MemoryRepository } from '../database/memoryRepository.js'
import type { SpecializedAgentId } from '../../shared/interfaces/ipc.js'
import { analyzeTerminalOutput } from '../productivity/terminalIntelligenceService.js'
import { analyzeUiUxFromMemory } from '../productivity/uiUxAnalysisService.js'
import { buildProductivityInsights } from '../productivity/productivityService.js'

export async function runSpecializedAgent(params: {
  agentId: SpecializedAgentId
  goal: string
  memoryRepository: MemoryRepository
  rootPath: string
}): Promise<string> {
  const { agentId, goal, memoryRepository, rootPath } = params
  if (agentId === 'developer') {
    const logs = memoryRepository.getRecentActivityLogs(80).map((item) => item.message).join('\n')
    const analysis = analyzeTerminalOutput(logs || goal)
    return `Developer analysis: ${analysis.summary}`
  }
  if (agentId === 'uiux') {
    const report = analyzeUiUxFromMemory(memoryRepository)
    return `UI/UX analysis: ${report.summary}`
  }
  if (agentId === 'memory') {
    const hits = memoryRepository.semanticKnowledgeSearch(goal, 5)
    return `Memory retrieval: ${hits.map((hit) => hit.chunk.content.slice(0, 90)).join(' | ') || 'No strong matches.'}`
  }
  if (agentId === 'automation') {
    const workflows = memoryRepository.getWorkflows().slice(0, 3).map((item) => item.name)
    return `Automation plan: reuse workflows ${workflows.join(', ') || 'none'}.`
  }
  const insights = await buildProductivityInsights(memoryRepository, rootPath)
  return `Research summary: ${insights.suggestedNextStep}`
}
