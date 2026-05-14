/**
 * Typed errors for the multimodal intelligence pipeline — easier to log and test.
 */
export class MultimodalIntelligenceError extends Error {
    cause;
    code;
    constructor(code, message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'MultimodalIntelligenceError';
        this.code = code;
    }
}
export function toMultimodalErrorMessage(error) {
    if (error instanceof MultimodalIntelligenceError)
        return error.message;
    if (error instanceof Error)
        return error.message;
    return 'Unknown multimodal intelligence error';
}
