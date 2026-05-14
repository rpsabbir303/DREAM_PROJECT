/**
 * Typed errors for the multimodal intelligence pipeline — easier to log and test.
 */

export class MultimodalIntelligenceError extends Error {
  readonly code: 'fusion' | 'prioritization' | 'prompt' | 'persistence' | 'sync'

  constructor(
    code: MultimodalIntelligenceError['code'],
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'MultimodalIntelligenceError'
    this.code = code
  }
}

export function toMultimodalErrorMessage(error: unknown): string {
  if (error instanceof MultimodalIntelligenceError) return error.message
  if (error instanceof Error) return error.message
  return 'Unknown multimodal intelligence error'
}
