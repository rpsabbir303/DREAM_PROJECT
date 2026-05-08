import { runKnowledgeIndexing } from './indexingEngine.js';
export class KnowledgeIndexingScheduler {
    memoryRepository;
    rootPath;
    timer = null;
    inFlight = false;
    constructor(memoryRepository, rootPath) {
        this.memoryRepository = memoryRepository;
        this.rootPath = rootPath;
    }
    start() {
        if (this.timer)
            return;
        this.timer = setInterval(() => {
            void this.reindex();
        }, 1000 * 60 * 8);
        void this.reindex();
    }
    stop() {
        if (!this.timer)
            return;
        clearInterval(this.timer);
        this.timer = null;
    }
    async reindex() {
        if (this.inFlight)
            return { ok: true, indexed: 0 };
        this.inFlight = true;
        try {
            return await runKnowledgeIndexing(this.memoryRepository, this.rootPath);
        }
        finally {
            this.inFlight = false;
        }
    }
}
