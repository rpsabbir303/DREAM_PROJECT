import { create } from 'zustand'
import { desktopClient } from '@/services/desktop/desktopClient'
import { startMicrophoneRecording, type RecordingSession } from '@/services/voice/microphoneService'
import { speakText, stopSpeaking } from '@/services/voice/speechSynthesisService'
import { useChatStore } from '@/store/chatStore'

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
  autoSpeakResponses: true,
  initialized: false,
  startListening: async () => {
    if (get().isListening) return
    try {
      recordingSession = await startMicrophoneRecording()
      set({ isListening: true, microphonePermission: 'granted', error: null })
    } catch (error) {
      set({
        isListening: false,
        microphonePermission: 'denied',
        error: error instanceof Error ? error.message : 'Microphone access failed.',
      })
    }
  },
  stopListening: async () => {
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

    desktopClient.onChatStreamEvent(async (event) => {
      if (event.type !== 'complete') return
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

    set({ initialized: true })
  },
}))
