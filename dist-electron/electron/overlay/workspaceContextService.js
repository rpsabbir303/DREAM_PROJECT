import { getActiveWindowInfo } from '../vision/activeWindowService.js';
export class WorkspaceContextService {
    memoryRepository;
    timer = null;
    lastSignature = '';
    constructor(memoryRepository) {
        this.memoryRepository = memoryRepository;
    }
    start() {
        if (this.timer)
            return;
        this.timer = setInterval(() => {
            void this.capture();
        }, 3000);
    }
    stop() {
        if (!this.timer)
            return;
        clearInterval(this.timer);
        this.timer = null;
    }
    async capture() {
        const active = await getActiveWindowInfo();
        if (!active)
            return null;
        const signature = `${active.app}:${active.title}:${active.processName}`;
        if (signature === this.lastSignature)
            return this.memoryRepository.getLatestWorkspaceContext();
        this.lastSignature = signature;
        const context = {
            app: active.app,
            title: active.title,
            processName: active.processName,
            timestamp: new Date().toISOString(),
        };
        this.memoryRepository.addWorkspaceContext(context);
        return context;
    }
}
