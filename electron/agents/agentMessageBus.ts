import { randomUUID } from 'node:crypto'
import type { AgentMessage, SpecializedAgentId } from '../../shared/interfaces/ipc.js'

export class AgentMessageBus {
  private messages: AgentMessage[] = []

  send(fromAgent: SpecializedAgentId, toAgent: SpecializedAgentId | 'broadcast', content: string) {
    const message: AgentMessage = {
      id: randomUUID(),
      fromAgent,
      toAgent,
      content,
      createdAt: new Date().toISOString(),
    }
    this.messages.push(message)
    return message
  }

  list() {
    return [...this.messages]
  }
}
