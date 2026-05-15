import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { AgentExecutionPlan, AgentPlanStep, ChatMessage, ExecutionActionType } from '../../shared/interfaces/ipc.js'
import { canUseConfiguredGemini } from './geminiEnv.js'
import { completeGeminiChat } from './providers/geminiProvider.js'
import { extractJsonTextFromModel } from './utils/geminiJsonText.js'

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

export async function planGoalWithGemini(goal: string): Promise<AgentExecutionPlan> {
  const now = new Date().toISOString()

  if (!canUseConfiguredGemini()) return fallbackPlan(goal, now)

  try {
    const messages: ChatMessage[] = [
      {
        id: randomUUID(),
        role: 'system',
        createdAt: now,
        content:
          'You are a desktop automation planner. Return JSON only (no markdown): { reasoning, steps[] }. actionType must be one of: open_application, open_path, open_url, run_terminal.',
      },
      {
        id: randomUUID(),
        role: 'user',
        createdAt: now,
        content: `Goal: ${goal}. Provide actionType in [open_application, open_path, open_url, run_terminal].`,
      },
    ]
    const raw = await completeGeminiChat({ messages })
    const content = extractJsonTextFromModel(raw)
    const parsed = planSchema.safeParse(JSON.parse(content))
    if (!parsed.success) return fallbackPlan(goal, now)
    return toPlan(goal, now, parsed.data.reasoning, parsed.data.steps)
  } catch {
    return fallbackPlan(goal, now)
  }
}

/** @deprecated Use `planGoalWithGemini`; kept for older module paths. */
export const planGoalWithOpenAi = planGoalWithGemini

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
