import { randomUUID } from 'node:crypto';
import { AgentMessageBus } from './agentMessageBus.js';
import { runSpecializedAgent } from './specializedAgents.js';
import { routeTaskToAgents } from './taskRouter.js';
const MAX_ROUTED_AGENTS = 5;
export class MultiAgentCoordinator {
    memoryRepository;
    rootPath;
    sessions = [];
    performance = new Map();
    constructor(memoryRepository, rootPath) {
        this.memoryRepository = memoryRepository;
        this.rootPath = rootPath;
    }
    async run(goal) {
        const selectedAgents = routeTaskToAgents(goal).slice(0, MAX_ROUTED_AGENTS);
        const bus = new AgentMessageBus();
        const session = {
            id: randomUUID(),
            goal,
            status: 'running',
            selectedAgents,
            nodes: selectedAgents.map((agentId) => ({
                agentId,
                status: 'queued',
                startedAt: null,
                completedAt: null,
                output: null,
            })),
            mergedOutput: '',
            messages: [],
            createdAt: new Date().toISOString(),
            completedAt: null,
        };
        for (const node of session.nodes) {
            const startedAt = Date.now();
            node.status = 'running';
            node.startedAt = new Date().toISOString();
            bus.send('coordinator', node.agentId, `Analyze goal segment for ${node.agentId}.`);
            try {
                node.output = await runSpecializedAgent({
                    agentId: node.agentId,
                    goal,
                    memoryRepository: this.memoryRepository,
                    rootPath: this.rootPath,
                });
                node.status = 'completed';
                node.completedAt = new Date().toISOString();
                this.track(node.agentId, Date.now() - startedAt, true);
            }
            catch (error) {
                node.output = error instanceof Error ? error.message : 'Unknown agent failure.';
                node.status = 'failed';
                node.completedAt = new Date().toISOString();
                this.track(node.agentId, Date.now() - startedAt, false);
            }
            bus.send(node.agentId, 'coordinator', node.output ?? '');
        }
        session.messages = bus.list();
        session.status = session.nodes.some((item) => item.status === 'failed') ? 'failed' : 'completed';
        session.mergedOutput = session.nodes
            .map((node) => `[${node.agentId}] ${node.output ?? 'no output'}`)
            .join('\n');
        session.completedAt = new Date().toISOString();
        this.sessions = [session, ...this.sessions].slice(0, 80);
        this.memoryRepository.addActivityLog('info', `Multi-agent run (${session.status}): ${goal}`);
        return session;
    }
    listSessions() {
        return [...this.sessions];
    }
    getPerformanceMetrics() {
        return Array.from(this.performance.entries()).map(([agentId, stats]) => ({
            agentId,
            runs: stats.runs,
            avgLatencyMs: Math.round(stats.totalLatencyMs / Math.max(stats.runs, 1)),
            successRate: Number((stats.success / Math.max(stats.runs, 1)).toFixed(2)),
        }));
    }
    track(agentId, latencyMs, success) {
        const current = this.performance.get(agentId) ?? { runs: 0, totalLatencyMs: 0, success: 0 };
        current.runs += 1;
        current.totalLatencyMs += latencyMs;
        if (success)
            current.success += 1;
        this.performance.set(agentId, current);
    }
}
