export function rebuildKnowledgeGraph(memoryRepository) {
    const workflows = memoryRepository.getWorkflows();
    const commands = memoryRepository.getRecentCommands(80);
    const projects = memoryRepository.getProjects();
    for (const project of projects) {
        const projectNode = `project:${project.id}`;
        for (const workflow of workflows.slice(0, 40)) {
            memoryRepository.upsertKnowledgeGraphEdge({
                fromNodeId: projectNode,
                toNodeId: `workflow:${workflow.id}`,
                relation: 'contains_workflow',
            });
        }
    }
    for (const workflow of workflows) {
        const workflowNode = `workflow:${workflow.id}`;
        for (const step of workflow.steps) {
            memoryRepository.upsertKnowledgeGraphEdge({
                fromNodeId: workflowNode,
                toNodeId: `command:${step.payload}`,
                relation: 'uses_command',
            });
        }
    }
    for (const command of commands.slice(0, 60)) {
        memoryRepository.upsertKnowledgeGraphEdge({
            fromNodeId: `conversation:${command.id}`,
            toNodeId: `command:${command.command}`,
            relation: 'mentions_command',
        });
    }
}
