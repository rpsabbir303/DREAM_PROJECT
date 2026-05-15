import { desktopClient } from '@/services/desktop/desktopClient'

/**
 * Renderer-side orchestration facade for desktop AI intents (Gemini chat runs in Electron main).
 */
export const chatEngine = {
  parseIntent(input: string) {
    return desktopClient.parseIntent(input)
  },
  executeCommand(input: string) {
    return desktopClient.executeIntent(input)
  },
}
