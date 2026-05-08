import type { ContextRetrievalResult, SemanticSearchFilter } from '../../shared/interfaces/ipc.js'
import type { MemoryRepository } from '../database/memoryRepository.js'

export function retrieveContext(
  memoryRepository: MemoryRepository,
  query: string,
  filter?: SemanticSearchFilter,
): ContextRetrievalResult {
  const hits = memoryRepository.semanticKnowledgeSearch(query, 8, filter)
  if (hits.length === 0) {
    return {
      summary: 'No strong contextual matches found.',
      snippets: [],
      sources: [],
    }
  }
  return {
    summary: `Retrieved ${hits.length} contextual memory match(es).`,
    snippets: hits.map((hit) => hit.chunk.content.slice(0, 220)),
    sources: hits.map((hit) => `${hit.chunk.sourceType}:${hit.chunk.sourceRef}`),
  }
}
