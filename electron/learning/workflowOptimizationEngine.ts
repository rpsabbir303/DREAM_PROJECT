import type { WorkflowOptimizationInsight, WorkflowRunRecord } from '../../shared/interfaces/ipc.js'

export function buildWorkflowOptimizationInsights(runs: WorkflowRunRecord[]): WorkflowOptimizationInsight[] {
  const byWorkflow = new Map<string, WorkflowRunRecord[]>()
  for (const run of runs) {
    const items = byWorkflow.get(run.workflowId) ?? []
    items.push(run)
    byWorkflow.set(run.workflowId, items)
  }

  const insights: WorkflowOptimizationInsight[] = []
  for (const [workflowId, items] of byWorkflow.entries()) {
    if (items.length < 2) continue
    const failed = items.filter((item) => item.status === 'failed').length
    const failRatio = failed / items.length
    if (failRatio < 0.4) continue

    const workflowName = items[0]?.workflowName ?? 'Unknown Workflow'
    insights.push({
      id: `opt:${workflowId}`,
      workflowId,
      workflowName,
      issue: `Failure rate is ${(failRatio * 100).toFixed(0)}% across ${items.length} runs.`,
      suggestion: 'Consider reordering high-risk steps and adding confirmation before terminal execution.',
      confidence: Number(Math.min(0.95, failRatio + 0.2).toFixed(2)),
      estimatedImpact: Number(Math.min(1, failRatio + 0.15).toFixed(2)),
      createdAt: new Date().toISOString(),
    })
  }
  return insights.slice(0, 12)
}
