import { ExecutionManager } from '../system/executionManager.js';
import { parseIntent } from '../ai/intentParser.js';
const MAX_PLAN_DEPTH = 15;
export class AgentOrchestrator {
    memoryRepository;
    executionManager;
    constructor(memoryRepository) {
        this.memoryRepository = memoryRepository;
        this.executionManager = new ExecutionManager(memoryRepository);
    }
    async executePlan(planId, options = {}) {
        const plan = this.memoryRepository.getAgentPlans(100).find((item) => item.id === planId);
        if (!plan)
            return { ok: false, message: 'Plan not found.' };
        if (plan.steps.length > MAX_PLAN_DEPTH)
            return { ok: false, message: 'Plan exceeds max depth.' };
        if (!this.validateDependencies(plan))
            return { ok: false, message: 'Plan has invalid dependencies.' };
        const startedAt = new Date().toISOString();
        this.memoryRepository.updateAgentPlanState(plan.id, 'executing');
        this.memoryRepository.addAgentRun({
            planId: plan.id,
            goal: plan.goal,
            state: 'executing',
            startedAt,
            completedAt: null,
            message: 'Plan execution started.',
        });
        const completed = new Set();
        const pending = [...plan.steps].sort((a, b) => a.order - b.order);
        for (const step of pending) {
            if (step.requiresConfirmation && !options.allowRiskyActions) {
                this.memoryRepository.updateAgentPlanState(plan.id, 'waiting');
                this.memoryRepository.addAgentRun({
                    planId: plan.id,
                    goal: plan.goal,
                    state: 'waiting',
                    startedAt,
                    completedAt: null,
                    message: `Waiting for confirmation before step: ${step.title}`,
                });
                return { ok: false, message: `Confirmation required for "${step.title}".` };
            }
            if (!step.dependsOnStepIds.every((id) => completed.has(id))) {
                this.memoryRepository.updateAgentPlanState(plan.id, 'waiting');
                continue;
            }
            let ok = false;
            let message = '';
            for (let attempt = 0; attempt <= step.retryLimit; attempt += 1) {
                if (attempt > 0)
                    this.memoryRepository.updateAgentPlanState(plan.id, 'retrying');
                const intent = this.stepToIntent(step.actionType, step.target);
                const result = await this.executionManager.runIntent(intent);
                ok = result.ok;
                message = result.message;
                if (ok)
                    break;
            }
            if (!ok) {
                this.memoryRepository.updateAgentPlanState(plan.id, 'failed');
                this.memoryRepository.addAgentRun({
                    planId: plan.id,
                    goal: plan.goal,
                    state: 'failed',
                    startedAt,
                    completedAt: new Date().toISOString(),
                    message: `Step failed: ${step.title} - ${message}`,
                });
                return { ok: false, message: `Plan failed at step "${step.title}". ${message}` };
            }
            completed.add(step.id);
        }
        this.memoryRepository.updateAgentPlanState(plan.id, 'completed');
        this.memoryRepository.addAgentRun({
            planId: plan.id,
            goal: plan.goal,
            state: 'completed',
            startedAt,
            completedAt: new Date().toISOString(),
            message: `Plan completed: ${plan.goal}`,
        });
        return { ok: true, message: `Plan executed successfully: ${plan.goal}` };
    }
    stepToIntent(actionType, target) {
        if (actionType === 'open_application')
            return parseIntent(`open ${target}`);
        if (actionType === 'open_url')
            return parseIntent(`open ${target}`);
        if (actionType === 'open_path')
            return parseIntent(`open ${target}`);
        return parseIntent(`run ${target}`);
    }
    validateDependencies(plan) {
        const stepIds = new Set(plan.steps.map((step) => step.id));
        for (const step of plan.steps) {
            for (const dep of step.dependsOnStepIds) {
                if (!stepIds.has(dep))
                    return false;
            }
        }
        return true;
    }
}
