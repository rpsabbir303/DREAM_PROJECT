export class EventBus {
    memoryRepository;
    listeners = [];
    constructor(memoryRepository) {
        this.memoryRepository = memoryRepository;
    }
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((item) => item !== listener);
        };
    }
    async publish(event) {
        const created = this.memoryRepository.addObservabilityEvent(event);
        for (const listener of this.listeners) {
            await listener(created);
        }
        return created;
    }
}
