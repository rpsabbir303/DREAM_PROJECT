import { ExecutionManager } from '../system/executionManager.js';
import { parseIntent } from './intentParser.js';
/**
 * IPC-facing command engine: parse → validate inside ExecutionManager → act → typed result.
 */
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
            const logStatus = result.ok
                ? 'success'
                : result.error === 'validation_failed'
                    ? 'warning'
                    : 'error';
            const logId = this.memoryRepository.addCommandLog(userInput, logStatus);
            return { ok: result.ok, message: result.message, logId };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown execution error';
            const logId = this.memoryRepository.addCommandLog(userInput, 'error');
            return { ok: false, message, logId };
        }
    }
}
