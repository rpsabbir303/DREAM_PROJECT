import { randomUUID } from 'node:crypto';
export class AgentMessageBus {
    messages = [];
    send(fromAgent, toAgent, content) {
        const message = {
            id: randomUUID(),
            fromAgent,
            toAgent,
            content,
            createdAt: new Date().toISOString(),
        };
        this.messages.push(message);
        return message;
    }
    list() {
        return [...this.messages];
    }
}
