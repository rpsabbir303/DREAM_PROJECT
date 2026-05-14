export interface RecordingSession {
  stop: () => Promise<{ audioBase64: string; mimeType: string }>
}

/** Ensures we never leave a MediaStream running if the user starts a new recording. */
let activeMediaStream: MediaStream | null = null

function stopActiveStreamTracks() {
  if (!activeMediaStream) return
  activeMediaStream.getTracks().forEach((track) => track.stop())
  activeMediaStream = null
}

/** Call on errors or navigation so the mic LED never sticks on. */
export function releaseMicrophoneHardStop() {
  stopActiveStreamTracks()
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Failed to encode recorded audio.'))
        return
      }
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(new Error('Failed to read recorded audio blob.'))
    reader.readAsDataURL(blob)
  })
}

export async function startMicrophoneRecording(): Promise<RecordingSession> {
  stopActiveStreamTracks()

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  activeMediaStream = stream

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: BlobPart[] = []

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  recorder.start()

  return {
    stop: () =>
      new Promise((resolve, reject) => {
        recorder.onstop = async () => {
          try {
            const blob = new Blob(chunks, { type: mimeType })
            const audioBase64 = await blobToBase64(blob)
            stopActiveStreamTracks()
            resolve({ audioBase64, mimeType })
          } catch (error) {
            stopActiveStreamTracks()
            reject(error)
          }
        }
        recorder.onerror = () => {
          stopActiveStreamTracks()
          reject(new Error('Microphone recorder error.'))
        }
        try {
          if (recorder.state === 'recording') recorder.stop()
          else stopActiveStreamTracks()
        } catch {
          stopActiveStreamTracks()
          reject(new Error('Failed to stop microphone recorder.'))
        }
      }),
  }
}
