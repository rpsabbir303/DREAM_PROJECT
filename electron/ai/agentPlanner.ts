import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { AgentExecutionPlan, AgentPlanStep, ExecutionActionType } from '../../shared/interfaces/ipc.js'
import { getEffectiveOpenAiApiKey, readProcessEnv } from './openAiEnv.js'

const planSchema = z.object({
  reasoning: z.string().min(5),
  steps: z
    .array(
      z.object({
        title: z.string().min(2),
        actionType: z.enum(['open_application', 'open_path', 'open_url', 'run_terminal']),
        target: z.string().min(1),
        dependsOnStepIds: z.array(z.string()).default([]),
        requiresConfirmation: z.boolean().default(false),
        retryLimit: z.number().int().min(0).max(3).default(1),
      }),
    )
    .min(1)
    .max(12),
})

export async function planGoalWithOpenAi(goal: string): Promise<AgentExecutionPlan> {
  const apiKey = getEffectiveOpenAiApiKey()
  const model = readProcessEnv('OPENAI_PLANNER_MODEL') ?? readProcessEnv('OPENAI_MODEL') ?? 'gpt-4o-mini'
  const now = new Date().toISOString()

  if (!apiKey) return fallbackPlan(goal, now)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a desktop automation planner. Return strict JSON: { reasoning, steps[] }. Keep steps safe and practical.',
        },
        {
          role: 'user',
          content: `Goal: ${goal}. Provide actionType in [open_application, open_path, open_url, run_terminal].`,
        },
      ],
    }),
  })

  if (!response.ok) return fallbackPlan(goal, now)
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) return fallbackPlan(goal, now)

  const parsed = planSchema.safeParse(JSON.parse(content))
  if (!parsed.success) return fallbackPlan(goal, now)
  return toPlan(goal, now, parsed.data.reasoning, parsed.data.steps)
}

function toPlan(
  goal: string,
  timestamp: string,
  reasoning: string,
  steps: Array<{
    title: string
    actionType: ExecutionActionType
    target: string
    dependsOnStepIds: string[]
    requiresConfirmation: boolean
    retryLimit: number
  }>,
): AgentExecutionPlan {
  const mapped: AgentPlanStep[] = steps.map((step, index) => ({
    id: randomUUID(),
    title: step.title,
    actionType: step.actionType,
    target: step.target,
    order: index + 1,
    dependsOnStepIds: step.dependsOnStepIds,
    requiresConfirmation: step.requiresConfirmation,
    retryLimit: step.retryLimit,
  }))
  return {
    id: randomUUID(),
    goal,
    reasoning,
    state: 'planning',
    steps: mapped,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function fallbackPlan(goal: string, timestamp: string): AgentExecutionPlan {
  return toPlan(goal, timestamp, 'Fallback planner used due unavailable structured response.', [
    {
      title: 'Open VS Code',
      actionType: 'open_application',
      target: 'VS Code',
      dependsOnStepIds: [],
      requiresConfirmation: false,
      retryLimit: 1,
    },
    {
      title: 'Start development server',
      actionType: 'run_terminal',
      target: 'npm run dev',
      dependsOnStepIds: [],
      requiresConfirmation: false,
      retryLimit: 1,
    },
  ])
}
