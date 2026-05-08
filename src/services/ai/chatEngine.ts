import { desktopClient } from '@/services/desktop/desktopClient'

/**
 * Renderer-side orchestration facade for future OpenAI/Ollama integrations.
 * Keeps UI components decoupled from transport and execution details.
 */
export const chatEngine = {
  parseIntent(input: string) {
    return desktopClient.parseIntent(input)
  },
  executeCommand(input: string) {
    return desktopClient.executeIntent(input)
  },
}
