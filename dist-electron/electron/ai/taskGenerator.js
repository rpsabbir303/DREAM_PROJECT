export function createTaskFromUnderstanding(understanding, memoryRepository) {
    if (!understanding.actionRequired)
        return null;
    const title = understanding.target && understanding.target.length > 0
        ? `${understanding.intent}: ${understanding.target}`
        : understanding.intent;
    return memoryRepository.addTask({
        title,
        intent: understanding.intent,
        target: understanding.target,
        status: 'pending',
    });
}
