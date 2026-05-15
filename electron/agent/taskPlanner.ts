/**
 * Task Planner — Phase 5
 *
 * Executes multi-step automation goals end-to-end:
 *   1. Plans using planGoalWithGemini (structured JSON plan)
 *   2. Translates each AgentPlanStep → ResolvedIntent
 *   3. Executes via pluginRegistry
 *   4. Reports step-by-step progress via callback
 *   5. Emits plan_step events on systemEvents bus
 */

import { safeLogger } from '../main/safeLogger.js'
import { planGoalWithGemini } from '../ai/agentPlanner.js'
import { executeIntent } from '../plugins/pluginRegistry.js'
import { getRiskLevel } from '../security/actionGuard.js'
import { systemEvents } from '../system/systemEvents.js'
import type { ResolvedIntent } from '../ai/nlpRouter.js'
import type { AgentPlanStep } from '../../shared/interfaces/ipc.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanProgress {
  step:    number
  total:   number
  label:   string
  ok:      boolean
  message: string
}

export type ProgressCallback = (p: PlanProgress) => void

// ─── Step → Intent translation ────────────────────────────────────────────────

function stepToIntent(step: AgentPlanStep, rawGoal: string): ResolvedIntent | null {
  switch (step.actionType) {
    case 'open_application':
      return {
        type:         'app.open',
        params:       { app: step.target },
        rawInput:     rawGoal,
        confidence:   0.9,
        riskLevel:    getRiskLevel('app.open'),
        displayLabel: step.title,
      }

    case 'open_path':
      return {
        type:         'folder.open',
        params:       { folder: step.target },
        rawInput:     rawGoal,
        confidence:   0.9,
        riskLevel:    getRiskLevel('folder.open'),
        displayLabel: step.title,
      }

    case 'open_url':
      return {
        type:         'browser.url',
        params:       { url: step.target },
        rawInput:     rawGoal,
        confidence:   0.9,
        riskLevel:    getRiskLevel('browser.url'),
        displayLabel: step.title,
      }

    case 'run_terminal':
      // Not yet supported — skip gracefully
      return null

    default:
      return null
  }
}

// ─── Execution ────────────────────────────────────────────────────────────────

/**
 * Execute a multi-step goal. Calls `onProgress` after each step.
 * Returns a summary string of all steps.
 */
export async function executePlan(
  goal: string,
  onProgress: ProgressCallback,
): Promise<string> {
  safeLogger.info(`[JARVIS_PLANNER] starting plan for goal="${goal}"`)

  const plan  = await planGoalWithGemini(goal)
  const total = plan.steps.length

  const lines: string[] = [
    `**Plan:** ${plan.reasoning}`,
    '',
    `**Steps (${total}):**`,
  ]

  for (let i = 0; i < plan.steps.length; i++) {
    const step    = plan.steps[i]
    const stepNum = i + 1
    const intent  = stepToIntent(step, goal)

    safeLogger.info(`[JARVIS_PLANNER] step ${stepNum}/${total} — "${step.title}" (${step.actionType} → ${step.target})`)

    if (!intent) {
      const msg = `${stepNum}. ${step.title} — ⚠️ skipped (action not supported yet)`
      lines.push(msg)
      onProgress({ step: stepNum, total, label: step.title, ok: false, message: msg })
      systemEvents.emit('plan_step', { step: stepNum, total, label: step.title, ok: false })
      continue
    }

    try {
      const result = await executeIntent(intent)
      const icon   = result.ok ? '✓' : '✗'
      const msg    = `${stepNum}. ${icon} ${result.message}`
      lines.push(msg)
      onProgress({ step: stepNum, total, label: step.title, ok: result.ok, message: msg })
      systemEvents.emit('plan_step', { step: stepNum, total, label: step.title, ok: result.ok })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const msg    = `${stepNum}. ✗ ${step.title} — failed: ${errMsg.slice(0, 100)}`
      lines.push(msg)
      onProgress({ step: stepNum, total, label: step.title, ok: false, message: msg })
      systemEvents.emit('plan_step', { step: stepNum, total, label: step.title, ok: false })
    }

    // Small settling delay between steps
    if (i < plan.steps.length - 1) {
      await new Promise<void>((r) => setTimeout(r, 800))
    }
  }

  lines.push('', 'All steps complete.')
  const summary = lines.join('\n')
  safeLogger.info(`[JARVIS_PLANNER] done — goal="${goal}"`)
  return summary
}
