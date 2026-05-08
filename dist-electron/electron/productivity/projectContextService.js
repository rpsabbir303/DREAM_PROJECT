import path from 'node:path';
import { promises as fs } from 'node:fs';
export async function detectProjectContext(rootPath) {
    const packageJsonPath = path.join(rootPath, 'package.json');
    let parsed = {};
    try {
        const raw = await fs.readFile(packageJsonPath, 'utf-8');
        parsed = JSON.parse(raw);
    }
    catch {
        // Read-only scan fallback.
    }
    const dependencies = Object.keys(parsed.dependencies ?? {});
    const devDependencies = Object.keys(parsed.devDependencies ?? {});
    const allDeps = [...dependencies, ...devDependencies];
    const frameworks = detectFrameworks(allDeps);
    const projectType = detectProjectType(frameworks);
    return {
        rootPath,
        projectName: parsed.name ?? path.basename(rootPath),
        frameworks,
        projectType,
        scripts: Object.keys(parsed.scripts ?? {}),
        dependencies,
        devDependencies,
        detectedAt: new Date().toISOString(),
    };
}
function detectFrameworks(deps) {
    const frameworkMap = [
        { key: 'react', name: 'React' },
        { key: 'next', name: 'Next.js' },
        { key: 'electron', name: 'Electron' },
        { key: 'vite', name: 'Vite' },
        { key: 'express', name: 'Express' },
        { key: 'nestjs', name: 'NestJS' },
        { key: 'tailwindcss', name: 'TailwindCSS' },
        { key: 'zustand', name: 'Zustand' },
        { key: 'typescript', name: 'TypeScript' },
    ];
    return frameworkMap.filter((item) => deps.includes(item.key)).map((item) => item.name);
}
function detectProjectType(frameworks) {
    const hasFrontend = frameworks.some((framework) => ['React', 'Next.js', 'Vite'].includes(framework));
    const hasBackend = frameworks.some((framework) => ['Express', 'NestJS'].includes(framework));
    const hasDesktop = frameworks.includes('Electron');
    if (hasFrontend && hasBackend)
        return 'fullstack';
    if (hasDesktop)
        return 'desktop';
    if (hasFrontend)
        return 'frontend';
    if (hasBackend)
        return 'backend';
    return 'unknown';
}
