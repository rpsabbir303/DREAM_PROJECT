import { randomUUID } from 'node:crypto'
import type { ChatMessage, DevTask } from '../../shared/interfaces/ipc.js'
import { canUseConfiguredGemini } from '../ai/geminiEnv.js'
import { completeGeminiChat } from '../ai/providers/geminiProvider.js'
import { extractJsonTextFromModel } from '../ai/utils/geminiJsonText.js'

export async function generateDeveloperTasks(prompt: string): Promise<DevTask[]> {
  if (!canUseConfiguredGemini()) return fallbackTasks(prompt)

  try {
    const now = new Date().toISOString()
    const messages: ChatMessage[] = [
      {
        id: randomUUID(),
        role: 'system',
        createdAt: now,
        content:
          'Return JSON only (no markdown) with field tasks[]. Each task has title, area(frontend|backend|qa|devops), priority(low|medium|high), steps:string[]. Max 6 tasks.',
      },
      {
        id: randomUUID(),
        role: 'user',
        createdAt: now,
        content: prompt,
      },
    ]
    const raw = await completeGeminiChat({ messages })
    const content = extractJsonTextFromModel(raw)
    const parsed = JSON.parse(content) as { tasks?: Array<Omit<DevTask, 'id'>> }
    if (!parsed.tasks || parsed.tasks.length === 0) return fallbackTasks(prompt)
    return parsed.tasks.slice(0, 6).map((task) => ({ ...task, id: randomUUID() }))
  } catch {
    return fallbackTasks(prompt)
  }
}

function fallbackTasks(prompt: string): DevTask[] {
  return [
    {
      id: randomUUID(),
      title: `Clarify scope for: ${prompt.slice(0, 50)}`,
      area: 'frontend',
      priority: 'medium',
      steps: ['Capture requirements', 'List impacted pages', 'Define acceptance criteria'],
    },
    {
      id: randomUUID(),
      title: 'Implement incremental feature slice',
      area: 'backend',
      priority: 'high',
      steps: ['Add typed contracts', 'Implement service logic', 'Wire IPC handlers'],
    },
    {
      id: randomUUID(),
      title: 'Validate and harden',
      area: 'qa',
      priority: 'medium',
      steps: ['Run build checks', 'Review edge cases', 'Document follow-up tasks'],
    },
  ]
}
