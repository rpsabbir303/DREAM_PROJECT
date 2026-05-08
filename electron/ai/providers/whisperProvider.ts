import type { VoiceTranscriptionInput, VoiceTranscriptionResult } from '../../../shared/interfaces/ipc.js'

function readEnv(name: string) {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : null
}

export async function transcribeAudioWithWhisper(
  input: VoiceTranscriptionInput,
): Promise<VoiceTranscriptionResult> {
  const apiKey = readEnv('OPENAI_API_KEY')
  const model = readEnv('OPENAI_WHISPER_MODEL') ?? 'whisper-1'
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing for Whisper transcription.')
  }

  const startedAt = Date.now()
  const binary = Buffer.from(input.audioBase64, 'base64')
  const form = new FormData()
  const blob = new Blob([binary], { type: input.mimeType })
  form.append('file', blob, 'voice-input.webm')
  form.append('model', model)

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown_error')
    throw new Error(`Whisper request failed: ${response.status} ${body}`)
  }

  const payload = (await response.json()) as { text?: string }
  return {
    text: payload.text?.trim() ?? '',
    durationMs: Date.now() - startedAt,
  }
}
