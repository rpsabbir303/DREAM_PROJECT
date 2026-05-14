/** Rotating “thinking” copy for a cinematic feel (deterministic per active stream). */
const THINKING_PHRASES = [
  'Synthesizing response…',
  'Neural core engaged…',
  'Processing request…',
  'Compiling answer…',
  'Calibrating context…',
] as const

const STREAMING_PHRASE = 'Rendering output…'

function hashStreamId(streamId: string | null): number {
  if (!streamId) return 0
  let h = 0
  for (let i = 0; i < streamId.length; i++) {
    h = (h + streamId.charCodeAt(i) * (i + 1)) % 10007
  }
  return h
}

export function jarvisThinkingLabel(streamId: string | null, isStreaming: boolean): string {
  if (isStreaming) return STREAMING_PHRASE
  const idx = hashStreamId(streamId) % THINKING_PHRASES.length
  return THINKING_PHRASES[idx] ?? 'Processing…'
}
