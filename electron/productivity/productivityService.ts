import type { MemoryRepository } from '../database/memoryRepository.js'
import type { ProductivityInsights } from '../../shared/interfaces/ipc.js'
import { detectProjectContext } from './projectContextService.js'

export async function buildProductivityInsights(
  memoryRepository: MemoryRepository,
  rootPath: string,
): Promise<ProductivityInsights> {
  const projectContext = await detectProjectContext(rootPath)
  const latestTerminal = memoryRepository.getRecentActivityLogs(50).find((log) =>
    /error|failed|warning|build|typescript/i.test(log.message),
  )
  const latestUiUx = memoryRepository.getRecentScreenAnalyses(1)[0]

  return {
    projectContext,
    latestTerminalSummary: latestTerminal?.message ?? 'No recent terminal issue summary available.',
    latestUiUxSummary: latestUiUx?.summary ?? 'No recent UI/UX screen analysis available.',
    suggestedNextStep:
      projectContext.scripts.includes('build')
        ? 'Run build and review terminal intelligence for blockers.'
        : 'Scan scripts and establish a standard dev/build workflow.',
    createdAt: new Date().toISOString(),
  }
}
