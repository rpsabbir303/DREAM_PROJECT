import path from 'node:path';
import { promises as fs } from 'node:fs';
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml']);
export async function collectProjectFiles(rootPath, maxFiles = 120) {
    const result = [];
    const queue = [rootPath];
    while (queue.length > 0 && result.length < maxFiles) {
        const current = queue.shift();
        if (!current)
            break;
        const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            if (entry.name.startsWith('.git') || entry.name === 'node_modules' || entry.name === 'dist')
                continue;
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                queue.push(fullPath);
                continue;
            }
            const ext = path.extname(entry.name).toLowerCase();
            if (TEXT_EXTENSIONS.has(ext))
                result.push(fullPath);
            if (result.length >= maxFiles)
                break;
        }
    }
    return result;
}
export async function summarizeFile(filePath, rootPath) {
    const content = await fs.readFile(filePath, 'utf-8').catch(() => null);
    if (!content)
        return null;
    const normalized = content.replace(/\s+/g, ' ').trim().slice(0, 800);
    if (!normalized)
        return null;
    return `${path.relative(rootPath, filePath)}: ${normalized}`;
}
