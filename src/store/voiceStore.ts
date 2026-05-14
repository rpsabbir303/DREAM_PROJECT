import { create } from 'zustand'
import { desktopClient } from '@/services/desktop/desktopClient'
import {
  releaseMicrophoneHardStop,
  startMicrophoneRecording,
  type RecordingSession,
} from '@/services/voice/microphoneService'
import { speakText, stopSpeaking } from '@/services/voice/speechSynthesisService'
import { useChatStore } from '@/store/chatStore'

/**
 * Flip to `true` to re-enable microphone capture, Whisper transcription, and TTS on chat `complete`.
 * Kept `false` while stabilizing text-only chat (avoids stuck "Listening…" / mic loops).
 */
export const VOICE_INPUT_ENABLED = false

interface VoiceStore {
  isListening: boolean
  isSpeaking: boolean
  isTranscribing: boolean
  microphonePermission: 'unknown' | 'granted' | 'denied'
  transcriptionText: string
  error: string | null
  autoSpeakResponses: boolean
  initialized: boolean
  startListening: () => Promise<void>
  stopListening: () => Promise<void>
  stopSpeakingNow: () => void
  initializeVoiceListener: () => void
}

let recordingSession: RecordingSession | null = null

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  isListening: false,
  isSpeaking: false,
  isTranscribing: false,
  microphonePermission: 'unknown',
  transcriptionText: '',
  error: null,
  autoSpeakResponses: false,
  initialized: false,
  startListening: async () => {
    if (!VOICE_INPUT_ENABLED) {
      console.info('[JARVIS_VOICE] startListening skipped (voice disabled)')
      return
    }
    if (get().isListening) return
    releaseMicrophoneHardStop()
    try {
      recordingSession = await startMicrophoneRecording()
      set({ isListening: true, microphonePermission: 'granted', error: null })
    } catch (error) {
      recordingSession = null
      set({
        isListening: false,
        microphonePermission: 'denied',
        error: error instanceof Error ? error.message : 'Microphone access failed.',
      })
    }
  },
  stopListening: async () => {
    if (!VOICE_INPUT_ENABLED) {
      releaseMicrophoneHardStop()
      recordingSession = null
      set({ isListening: false, isTranscribing: false, error: null })
      console.info('[JARVIS_VOICE] stopListening — voice disabled, state cleared')
      return
    }
    if (!recordingSession || !get().isListening) return
    set({ isListening: false, isTranscribing: true })
    try {
      const audio = await recordingSession.stop()
      recordingSession = null
      const transcript = await desktopClient.transcribeAudio(audio)
      const text = transcript?.text?.trim() ?? ''
      set({ transcriptionText: text, isTranscribing: false })
      if (text.length > 0) {
        await useChatStore.getState().sendMessage(text)
      }
    } catch (error) {
      recordingSession = null
      releaseMicrophoneHardStop()
      set({
        isTranscribing: false,
        error: error instanceof Error ? error.message : 'Voice transcription failed.',
      })
    }
  },
  stopSpeakingNow: () => {
    stopSpeaking()
    set({ isSpeaking: false })
  },
  initializeVoiceListener: () => {
    if (get().initialized) return

    stopSpeaking()
    releaseMicrophoneHardStop()
    recordingSession = null
    set({
      isListening: false,
      isTranscribing: false,
      isSpeaking: false,
      autoSpeakResponses: false,
      error: null,
    })

    if (!VOICE_INPUT_ENABLED) {
      console.info('[JARVIS_VOICE] pipeline disabled — text chat only (no mic / Whisper / TTS)')
      set({ initialized: true })
      return
    }

    desktopClient.onChatStreamEvent((event) => {
      if (event.type === 'start') {
        stopSpeaking()
        set({ isSpeaking: false })
        return
      }
      if (event.type !== 'complete') return
      if (!get().autoSpeakResponses) return

      queueMicrotask(async () => {
        if (!get().autoSpeakResponses) return
        try {
          set({ isSpeaking: true })
          await speakText(event.data.finalText)
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'TTS playback failed.' })
        } finally {
          set({ isSpeaking: false })
        }
      })
    })

    set({ initialized: true })
  },
}))
