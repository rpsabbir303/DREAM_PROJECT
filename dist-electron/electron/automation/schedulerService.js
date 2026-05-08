import { WorkflowEngine } from './workflowEngine.js';
export class SchedulerService {
    memoryRepository;
    timer = null;
    workflowEngine;
    runningWorkflowIds = new Set();
    constructor(memoryRepository) {
        this.memoryRepository = memoryRepository;
        this.workflowEngine = new WorkflowEngine(memoryRepository);
    }
    start() {
        if (this.timer)
            return;
        this.timer = setInterval(() => {
            void this.tick();
        }, 60_000);
        void this.tick();
    }
    stop() {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
    }
    async tick() {
        const schedules = this.memoryRepository.getWorkflowSchedules().filter((item) => item.isEnabled);
        const now = new Date();
        for (const schedule of schedules) {
            if (!this.shouldRun(schedule, now))
                continue;
            if (this.runningWorkflowIds.has(schedule.workflowId))
                continue;
            this.runningWorkflowIds.add(schedule.workflowId);
            try {
                await this.workflowEngine.executeWorkflow(schedule.workflowId);
                this.memoryRepository.updateWorkflowScheduleLastRun(schedule.id, new Date().toISOString());
            }
            finally {
                this.runningWorkflowIds.delete(schedule.workflowId);
            }
        }
    }
    shouldRun(schedule, now) {
        const lastRun = schedule.lastRunAt ? new Date(schedule.lastRunAt) : null;
        if (schedule.scheduleType === 'manual')
            return false;
        if (schedule.scheduleType === 'once') {
            if (!schedule.runAt)
                return false;
            if (now < new Date(schedule.runAt))
                return false;
            if (lastRun)
                return false;
            return true;
        }
        if (!schedule.timeOfDay)
            return false;
        const [h, m] = schedule.timeOfDay.split(':').map((value) => Number(value));
        if (now.getHours() !== h || now.getMinutes() !== m)
            return false;
        if (schedule.scheduleType === 'weekly' && schedule.dayOfWeek !== now.getDay())
            return false;
        if (!lastRun)
            return true;
        const sameDay = lastRun.getFullYear() === now.getFullYear() &&
            lastRun.getMonth() === now.getMonth() &&
            lastRun.getDate() === now.getDate();
        return !sameDay;
    }
}
