import { randomUUID } from 'node:crypto'
import type { MemoryRepository } from '../database/memoryRepository.js'
import type { ScreenAnalysisResult, ScreenCaptureRecord } from '../../shared/interfaces/ipc.js'
import { getActiveWindowInfo } from './activeWindowService.js'
import { extractTextFromImageBase64 } from './ocrService.js'

export async function analyzeCapture(
  capture: ScreenCaptureRecord,
  memoryRepository: MemoryRepository,
): Promise<ScreenAnalysisResult> {
  const [ocr, activeWindow] = await Promise.all([
    extractTextFromImageBase64(capture.imageBase64),
    getActiveWindowInfo(),
  ])

  const summary = buildSummary(ocr.text, activeWindow?.app ?? null)
  const analysis: ScreenAnalysisResult = {
    id: randomUUID(),
    summary,
    ocrText: ocr.text,
    confidence: ocr.confidence,
    activeWindow,
    createdAt: new Date().toISOString(),
  }

  memoryRepository.addScreenCapture(capture)
  memoryRepository.addScreenAnalysis(analysis)
  memoryRepository.addActivityLog('info', `Screen analyzed: ${summary}`)
  return analysis
}

function buildSummary(text: string, appName: string | null) {
  const compressed = text.replace(/\s+/g, ' ').trim()
  if (!compressed) {
    return appName ? `No readable text detected in ${appName}.` : 'No readable text detected on screen.'
  }
  const snippet = compressed.slice(0, 160)
  return appName ? `${appName}: ${snippet}` : snippet
}
