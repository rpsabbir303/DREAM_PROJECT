import { randomUUID } from 'node:crypto'
import type { CrossModalReasoningHint, PrioritizedContextSlice } from '../../shared/multimodal/types.js'

const ERRORISH = /error|exception|failed|fatal|panic|traceback|eaddrinuse|enoent|syntaxerror/i

function contentOf(slices: PrioritizedContextSlice[], kind: PrioritizedContextSlice['chunk']['kind']): string {
  return slices
    .filter((s) => s.chunk.kind === kind)
    .map((s) => s.chunk.content)
    .join('\n')
}

/**
 * Lightweight cross-modal heuristics — text only, no image understanding.
 * Surfaces hypotheses when multiple modalities agree on failure signals.
 */
export function buildCrossModalReasoningHints(
  slices: PrioritizedContextSlice[],
  userInput: string,
): CrossModalReasoningHint[] {
  const hints: CrossModalReasoningHint[] = []
  const screenBlob = contentOf(slices, 'screen')
  const terminalBlob = contentOf(slices, 'client_terminal')
  const obsBlob = contentOf(slices, 'observability')
  const productivityBlob = contentOf(slices, 'productivity')

  if (screenBlob && terminalBlob && (ERRORISH.test(screenBlob) || ERRORISH.test(terminalBlob))) {
    hints.push({
      id: randomUUID(),
      summary:
        'Screen-derived text and the supplied terminal excerpt both contain failure-like language — treat as a single incident and reconcile timestamps before suggesting fixes.',
      relatedModalities: ['screen', 'client_terminal'],
    })
  }

  if (obsBlob && ERRORISH.test(obsBlob) && (terminalBlob || productivityBlob)) {
    hints.push({
      id: randomUUID(),
      summary:
        'Observability shows recent errors while productivity/terminal context is present — prioritize explaining how automation or build steps relate to those events.',
      relatedModalities: ['observability', terminalBlob ? 'client_terminal' : 'productivity'],
    })
  }

  if (/voice|heard|said|dictat/i.test(userInput) && screenBlob) {
    hints.push({
      id: randomUUID(),
      summary:
        'Voice intent references may not capture on-screen controls — confirm critical UI labels against OCR excerpts before giving click-level guidance.',
      relatedModalities: ['screen', 'workspace'],
    })
  }

  return hints
}
