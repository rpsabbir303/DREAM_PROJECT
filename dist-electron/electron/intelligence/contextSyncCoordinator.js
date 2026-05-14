/**
 * Builds a compact synchronization snapshot so UI layers can reflect freshness without extra IPC round-trips.
 */
export function buildContextSyncSnapshot(memory) {
    const workspace = memory.getLatestWorkspaceContext();
    const screens = memory.getRecentScreenAnalyses(1);
    const events = memory.getRecentObservabilityEvents(80);
    const workflows = memory.getWorkflows();
    const runs = memory.getWorkflowRuns(40);
    const errorEvents = events.filter((e) => e.severity === 'error').length;
    const failedRuns = runs.filter((r) => r.status === 'failed').length;
    return {
        updatedAt: new Date().toISOString(),
        hasWorkspace: Boolean(workspace),
        lastScreenAnalysisAt: screens[0]?.createdAt ?? null,
        recentObservabilityErrors: errorEvents,
        activeWorkflowCount: workflows.length,
        recentFailedWorkflowRuns: failedRuns,
    };
}
