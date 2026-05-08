import { randomUUID } from 'node:crypto'
import type { MemoryRepository } from '../database/memoryRepository.js'
import { collectProjectFiles, summarizeFile } from './fileUnderstandingService.js'
import { rebuildKnowledgeGraph } from './knowledgeGraphService.js'
import type { KnowledgeChunk } from '../../shared/interfaces/ipc.js'

function chunkText(text: string, maxLength = 420) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return [normalized]
  const chunks: string[] = []
  let start = 0
  while (start < normalized.length) {
    chunks.push(normalized.slice(start, start + maxLength))
    start += maxLength
  }
  return chunks
}

export async function runKnowledgeIndexing(memoryRepository: MemoryRepository, rootPath: string) {
  memoryRepository.setIndexingStatus({ isRunning: true })
  memoryRepository.clearKnowledgeIndex()
  let indexed = 0
  const now = new Date().toISOString()

  const conversations = memoryRepository.getRecentConversations(120)
  for (const message of conversations) {
    for (const piece of chunkText(message.content)) {
      const chunk: KnowledgeChunk = {
        id: randomUUID(),
        sourceType: 'conversation',
        sourceRef: message.id,
        content: piece,
        metadata: { role: message.role },
        indexedAt: now,
      }
      memoryRepository.indexKnowledgeChunk(chunk)
      indexed += 1
    }
  }

  const workflows = memoryRepository.getWorkflows()
  for (const workflow of workflows) {
    const chunk: KnowledgeChunk = {
      id: randomUUID(),
      sourceType: 'workflow',
      sourceRef: workflow.id,
      content: `${workflow.name} ${workflow.description} ${workflow.steps.map((step) => step.payload).join(' ')}`,
      metadata: { steps: String(workflow.steps.length) },
      indexedAt: now,
    }
    memoryRepository.indexKnowledgeChunk(chunk)
    indexed += 1
  }

  const screen = memoryRepository.getRecentScreenAnalyses(40)
  for (const analysis of screen) {
    const chunk: KnowledgeChunk = {
      id: randomUUID(),
      sourceType: 'screenshot',
      sourceRef: analysis.id,
      content: `${analysis.summary} ${analysis.ocrText.slice(0, 300)}`,
      metadata: { confidence: String(analysis.confidence) },
      indexedAt: now,
    }
    memoryRepository.indexKnowledgeChunk(chunk)
    indexed += 1
  }

  const logs = memoryRepository.getRecentActivityLogs(120)
  for (const log of logs) {
    const chunk: KnowledgeChunk = {
      id: randomUUID(),
      sourceType: 'activity',
      sourceRef: log.id,
      content: log.message,
      metadata: { level: log.level },
      indexedAt: now,
    }
    memoryRepository.indexKnowledgeChunk(chunk)
    indexed += 1
  }

  const files = await collectProjectFiles(rootPath, 80)
  for (const filePath of files) {
    const summary = await summarizeFile(filePath, rootPath)
    if (!summary) continue
    const chunk: KnowledgeChunk = {
      id: randomUUID(),
      sourceType: 'project_file',
      sourceRef: filePath,
      content: summary,
      metadata: { path: filePath },
      indexedAt: now,
    }
    memoryRepository.indexKnowledgeChunk(chunk)
    indexed += 1
  }

  rebuildKnowledgeGraph(memoryRepository)
  memoryRepository.setIndexingStatus({
    isRunning: false,
    indexedChunkCount: indexed,
    lastIndexedAt: now,
  })
  return { ok: true as const, indexed }
}
