import { ExecutionManager } from '../system/executionManager.js';
import { parseIntent } from '../ai/intentParser.js';
const STEP_RETRY_LIMIT = 1;
export class WorkflowEngine {
    memoryRepository;
    executionManager;
    constructor(memoryRepository) {
        this.memoryRepository = memoryRepository;
        this.executionManager = new ExecutionManager(memoryRepository);
    }
    async executeWorkflow(workflowId) {
        const workflow = this.memoryRepository.getWorkflows().find((item) => item.id === workflowId);
        if (!workflow)
            return { ok: false, message: 'Workflow not found.' };
        const validation = this.validateWorkflow(workflow);
        if (!validation.ok)
            return { ok: false, message: validation.message };
        const steps = [...workflow.steps].sort((a, b) => a.order - b.order);
        const startedAt = new Date().toISOString();
        this.memoryRepository.addWorkflowRun({
            workflowId: workflow.id,
            workflowName: workflow.name,
            status: 'running',
            startedAt,
            completedAt: null,
            message: 'Workflow started.',
        });
        for (const step of steps) {
            let success = false;
            let lastMessage = '';
            for (let attempt = 0; attempt <= STEP_RETRY_LIMIT; attempt += 1) {
                const intent = this.stepToIntent(step);
                const result = await this.executionManager.runIntent(intent);
                lastMessage = result.message;
                if (result.ok) {
                    success = true;
                    break;
                }
                if (attempt < STEP_RETRY_LIMIT) {
                    await this.delay(500);
                }
            }
            if (!success) {
                const completedAt = new Date().toISOString();
                this.memoryRepository.addWorkflowRun({
                    workflowId: workflow.id,
                    workflowName: workflow.name,
                    status: 'failed',
                    startedAt,
                    completedAt,
                    message: `Step ${step.order} failed: ${lastMessage}`,
                });
                this.memoryRepository.addLearningFeedback({
                    type: 'workflow_failed',
                    source: 'workflow',
                    action: workflow.name,
                    outcome: 'failure',
                    score: 0,
                    metadata: { step: String(step.order), workflowId: workflow.id },
                    createdAt: new Date().toISOString(),
                });
                return { ok: false, message: `Workflow failed on step ${step.order}: ${lastMessage}` };
            }
            await this.delay(300);
        }
        const completedAt = new Date().toISOString();
        this.memoryRepository.addWorkflowRun({
            workflowId: workflow.id,
            workflowName: workflow.name,
            status: 'completed',
            startedAt,
            completedAt,
            message: `Workflow completed: ${workflow.name}`,
        });
        this.memoryRepository.addLearningFeedback({
            type: 'workflow_completed',
            source: 'workflow',
            action: workflow.name,
            outcome: 'success',
            score: 1,
            metadata: { workflowId: workflow.id, stepCount: String(steps.length) },
            createdAt: new Date().toISOString(),
        });
        this.memoryRepository.addActivityLog('info', `Executed workflow: ${workflow.name}`);
        return { ok: true, message: `Workflow executed: ${workflow.name}` };
    }
    stepToIntent(step) {
        if (step.type === 'open_application') {
            return parseIntent(`open ${step.payload}`);
        }
        if (step.type === 'open_path') {
            return parseIntent(`open ${step.payload}`);
        }
        if (step.type === 'open_url') {
            return parseIntent(`open ${step.payload}`);
        }
        return parseIntent(`run ${step.payload}`);
    }
    validateWorkflow(workflow) {
        if (workflow.steps.length === 0)
            return { ok: false, message: 'Workflow has no steps.' };
        if (workflow.steps.length > 20)
            return { ok: false, message: 'Workflow exceeds max step limit.' };
        const orders = new Set();
        for (const step of workflow.steps) {
            if (orders.has(step.order))
                return { ok: false, message: 'Workflow has duplicate step order.' };
            orders.add(step.order);
        }
        return { ok: true, message: 'ok' };
    }
    async delay(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
}
