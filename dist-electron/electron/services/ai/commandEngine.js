import { parseIntent } from './intentParser.js';
import { executeIntent } from '../system/actionExecutor.js';
export class CommandEngine {
    memoryRepository;
    constructor(memoryRepository) {
        this.memoryRepository = memoryRepository;
    }
    parse(userInput) {
        return parseIntent(userInput);
    }
    async handle(userInput) {
        const parsed = parseIntent(userInput);
        try {
            const message = await executeIntent(parsed);
            const logId = this.memoryRepository.addCommandLog(userInput, 'success');
            return { ok: true, message, logId };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown execution error';
            const logId = this.memoryRepository.addCommandLog(userInput, 'error');
            return { ok: false, message, logId };
        }
    }
}
