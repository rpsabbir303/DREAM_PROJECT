function readEnv(name) {
    const value = process.env[name];
    return value && value.trim().length > 0 ? value.trim() : null;
}
export async function streamOpenAiResponse({ messages, model, onDelta, signal, }) {
    const apiKey = readEnv('OPENAI_API_KEY');
    const targetModel = model ?? readEnv('OPENAI_MODEL') ?? 'gpt-4o-mini';
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is missing. Add it to your desktop environment.');
    }
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: targetModel,
            stream: true,
            messages: messages.map((message) => ({ role: message.role, content: message.content })),
        }),
        signal,
    });
    if (!response.ok || !response.body) {
        const errorBody = await response.text().catch(() => 'Unknown API error');
        throw new Error(`OpenAI request failed: ${response.status} ${errorBody}`);
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
            if (!trimmed.startsWith('data:'))
                continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]')
                continue;
            const parsed = JSON.parse(payload);
            const chunk = parsed.choices?.[0]?.delta?.content ?? '';
            if (!chunk)
                continue;
            finalText += chunk;
            onDelta(chunk);
        }
    }
    return finalText;
}
