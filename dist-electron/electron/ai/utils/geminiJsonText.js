/** Strip optional ``` / ```json fences so JSON.parse succeeds on model output. */
export function extractJsonTextFromModel(raw) {
    const t = raw.trim();
    const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(t);
    if (fenced)
        return fenced[1].trim();
    return t;
}
