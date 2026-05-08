import { EventBus } from './eventBus.js';
import { ProactiveAwarenessEngine } from './proactiveAwarenessEngine.js';
import { WorkspaceObservers } from './workspaceObservers.js';
export class ObservabilityOrchestrator {
    eventBus;
    awareness;
    observers;
    unsubscribe = null;
    constructor(memoryRepository) {
        this.eventBus = new EventBus(memoryRepository);
        this.awareness = new ProactiveAwarenessEngine(memoryRepository);
        this.observers = new WorkspaceObservers(memoryRepository, this.eventBus);
    }
    start() {
        if (!this.unsubscribe) {
            this.unsubscribe = this.eventBus.subscribe(async (event) => {
                await this.awareness.handleEvent(event);
            });
        }
        this.observers.start();
        void this.eventBus.publish({
            type: 'app_opened',
            source: 'system',
            severity: 'info',
            title: 'Assistant Started',
            message: 'Observability engine is active.',
            metadata: {},
            createdAt: new Date().toISOString(),
        });
    }
    stop() {
        this.observers.stop();
        this.unsubscribe?.();
        this.unsubscribe = null;
    }
}
