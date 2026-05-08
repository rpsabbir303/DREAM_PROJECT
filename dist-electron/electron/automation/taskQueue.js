export class AutomationTaskQueue {
    queue = [];
    enqueue(task) {
        this.queue.push(task);
    }
    drain() {
        const tasks = [...this.queue];
        this.queue = [];
        return tasks;
    }
}
