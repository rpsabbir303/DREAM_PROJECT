const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
export async function listOllamaModels() {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        if (!response.ok)
            return [];
        const payload = (await response.json());
        return (payload.models ?? []).map((model) => model.name);
    }
    catch {
        return [];
    }
}
export async function streamOllamaResponse({ messages, model, onDelta, signal, }) {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            stream: true,
            messages: messages.map((message) => ({ role: message.role, content: message.content })),
        }),
        signal,
    });
    if (!response.ok || !response.body) {
        const body = await response.text().catch(() => 'unknown_error');
        throw new Error(`Ollama request failed: ${response.status} ${body}`);
    }
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let pending = '';
    let finalText = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            const parsed = JSON.parse(trimmed);
            const chunk = parsed.message?.content ?? '';
            if (!chunk)
                continue;
            finalText += chunk;
            onDelta(chunk);
        }
    }
    return finalText;
}
