export function speakText(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('SpeechSynthesis API is unavailable in this environment.'))
      return
    }
    if (!text.trim()) {
      resolve()
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onend = () => {
      resolve()
    }
    utterance.onerror = () => {
      reject(new Error('Text-to-speech playback failed.'))
    }
    window.speechSynthesis.speak(utterance)
  })
}

export function stopSpeaking() {
  window.speechSynthesis.cancel()
}
