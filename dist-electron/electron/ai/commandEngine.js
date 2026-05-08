import { ExecutionManager } from '../system/executionManager.js';
import { parseIntent } from './intentParser.js';
export class CommandEngine {
    memoryRepository;
    executionManager;
    constructor(memoryRepository) {
        this.memoryRepository = memoryRepository;
        this.executionManager = new ExecutionManager(memoryRepository);
    }
    parse(userInput) {
        return parseIntent(userInput);
    }
    async handle(userInput) {
        const parsed = parseIntent(userInput);
        try {
            const result = await this.executionManager.runIntent(parsed);
            const logId = this.memoryRepository.addCommandLog(userInput, 'success');
            return { ok: result.ok, message: result.message, logId };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown execution error';
            const logId = this.memoryRepository.addCommandLog(userInput, 'error');
            return { ok: false, message, logId };
        }
    }
}
