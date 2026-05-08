export interface WorkflowDefinition {
  id: string
  name: string
  trigger: string
}

/**
 * Placeholder service boundary for workflow automation modules.
 */
export const workflowService = {
  listWorkflows(): WorkflowDefinition[] {
    return []
  },
}
