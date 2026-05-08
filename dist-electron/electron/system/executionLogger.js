export class ExecutionLogger {
    memoryRepository;
    constructor(memoryRepository) {
        this.memoryRepository = memoryRepository;
    }
    log(level, message) {
        this.memoryRepository.addActivityLog(level, message);
    }
}
