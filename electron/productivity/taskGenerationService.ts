import { randomUUID } from 'node:crypto'
import type { DevTask } from '../../shared/interfaces/ipc.js'
import { getEffectiveOpenAiApiKey, readProcessEnv } from '../ai/openAiEnv.js'

export async function generateDeveloperTasks(prompt: string): Promise<DevTask[]> {
  const apiKey = getEffectiveOpenAiApiKey()
  if (!apiKey) return fallbackTasks(prompt)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: readProcessEnv('OPENAI_MODEL') ?? 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Return JSON with field tasks[]. Each task has title, area(frontend|backend|qa|devops), priority(low|medium|high), steps:string[]. Max 6 tasks.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })
    if (!response.ok) return fallbackTasks(prompt)
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content
    if (!content) return fallbackTasks(prompt)
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
