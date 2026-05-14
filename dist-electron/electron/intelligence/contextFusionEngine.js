import { randomUUID } from 'node:crypto';
import { buildProductivityInsights } from '../productivity/productivityService.js';
const SCREEN_CONTEXT_TRIGGER = /(screen|visible|ui|dashboard|what.*see|window|overlay|ocr|screenshot|terminal output|error on my screen)/i;
function shouldAttachScreenAnalyses(prefs, userInput) {
    if (prefs.includeScreenAnalyses === 'never')
        return false;
    if (prefs.includeScreenAnalyses === 'always')
        return true;
    return SCREEN_CONTEXT_TRIGGER.test(userInput);
}
function clip(text, max) {
    if (text.length <= max)
        return text;
    return `${text.slice(0, max)}\n… [truncated ${text.length - max} chars]`;
}
/**
 * Aggregates heterogeneous desktop signals into normalized text chunks for prioritization.
 * Does not call remote AI — local assembly only.
 */
export async function fuseMultimodalContext(params) {
    const { memory, userInput, preferences, clientTerminalSnippet, cwd } = params;
    const chunks = [];
    const privacyNotes = [];
    if (preferences.includeWorkspace) {
        const ws = memory.getLatestWorkspaceContext();
        if (ws) {
            chunks.push({
                id: randomUUID(),
                kind: 'workspace',
                title: 'Active workspace',
                content: `App: ${ws.app}\nTitle: ${ws.title}\nProcess: ${ws.processName}\nRecorded: ${ws.timestamp}`,
                createdAt: ws.timestamp,
                weightHints: { pinned: true },
            });
        }
    }
    if (preferences.includeScreenAnalyses !== 'never' && shouldAttachScreenAnalyses(preferences, userInput)) {
        const analyses = memory.getRecentScreenAnalyses(3);
        for (const a of analyses) {
            chunks.push({
                id: randomUUID(),
                kind: 'screen',
                title: 'Screen analysis',
                content: [
                    `Summary: ${a.summary}`,
                    `OCR (excerpt): ${clip(a.ocrText, 1200)}`,
                    a.activeWindow ? `Foreground: ${a.activeWindow.app} — ${a.activeWindow.title}` : '',
                    `Captured: ${a.createdAt}`,
                ]
                    .filter(Boolean)
                    .join('\n'),
                createdAt: a.createdAt,
                weightHints: {},
            });
        }
        if (analyses.length === 0) {
            chunks.push({
                id: randomUUID(),
                kind: 'screen',
                title: 'Screen analysis',
                content: 'No recent screen analysis available. User can run screen capture + analysis from the assistant.',
                weightHints: { severity: 'info' },
            });
        }
    }
    else if (preferences.includeScreenAnalyses === 'auto') {
        privacyNotes.push('Screen/OCR fusion skipped (no trigger in user message and mode is auto).');
    }
    if (preferences.includeSemanticMemory) {
        const hits = memory.semanticSearch(userInput, 8);
        if (hits.length > 0) {
            chunks.push({
                id: randomUUID(),
                kind: 'semantic_memory',
                title: 'Semantic memory',
                content: hits.map((h) => `- [${h.kind}] ${clip(h.content, 400)} (score ${h.score.toFixed(3)})`).join('\n'),
                weightHints: {},
            });
        }
    }
    if (preferences.includeKnowledgeIndex) {
        const hits = memory.semanticKnowledgeSearch(userInput, 8);
        if (hits.length > 0) {
            chunks.push({
                id: randomUUID(),
                kind: 'knowledge_index',
                title: 'Indexed knowledge',
                content: hits
                    .map((h) => `- (${h.chunk.sourceType}) ${clip(h.chunk.content, 320)}`)
                    .join('\n'),
                weightHints: {},
            });
        }
    }
    if (preferences.includeObservability) {
        const events = memory.getRecentObservabilityEvents(40);
        if (events.length > 0) {
            const lines = events.slice(0, 24).map((e) => `- [${e.severity}] ${e.type}: ${e.title} — ${clip(e.message, 200)}`);
            chunks.push({
                id: randomUUID(),
                kind: 'observability',
                title: 'Observability (recent)',
                content: lines.join('\n'),
                createdAt: events[0]?.createdAt,
                weightHints: { severity: 'info' },
            });
        }
    }
    else {
        privacyNotes.push('Observability stream excluded by preference (privacy).');
    }
    if (preferences.includeActivityLogs) {
        const logs = memory.getRecentActivityLogs(24);
        if (logs.length > 0) {
            chunks.push({
                id: randomUUID(),
                kind: 'activity_log',
                title: 'Activity / execution logs',
                content: logs.map((l) => `- [${l.level}] ${clip(l.message, 240)} @ ${l.createdAt}`).join('\n'),
                weightHints: {},
            });
        }
    }
    if (preferences.includeWorkflowContext) {
        const workflows = memory.getWorkflows();
        const runs = memory.getWorkflowRuns(8);
        if (workflows.length > 0 || runs.length > 0) {
            const wfLines = workflows.slice(0, 12).map((w) => `- ${w.name} (${w.steps.length} steps)`);
            const runLines = runs.map((r) => `- ${r.workflowName}: ${r.status} — ${clip(r.message, 160)}`);
            chunks.push({
                id: randomUUID(),
                kind: 'workflow',
                title: 'Workflows & runs',
                content: ['Definitions:', ...wfLines, 'Recent runs:', ...runLines].join('\n'),
                weightHints: {},
            });
        }
    }
    if (preferences.includeExecutionTasks) {
        const tasks = memory.getRecentTasks(12);
        if (tasks.length > 0) {
            chunks.push({
                id: randomUUID(),
                kind: 'task',
                title: 'Assistant tasks',
                content: tasks.map((t) => `- [${t.status}] ${t.title} (${t.intent})`).join('\n'),
                weightHints: {},
            });
        }
    }
    if (preferences.includeProductivity) {
        const insights = await buildProductivityInsights(memory, cwd);
        chunks.push({
            id: randomUUID(),
            kind: 'productivity',
            title: 'Developer productivity digest',
            content: [
                insights.projectContext
                    ? `Project: ${insights.projectContext.projectName} (${insights.projectContext.projectType}) @ ${insights.projectContext.rootPath}`
                    : 'Project context unavailable.',
                `Terminal signal: ${clip(insights.latestTerminalSummary, 800)}`,
                `UI signal: ${clip(insights.latestUiUxSummary, 800)}`,
                `Suggested next step: ${insights.suggestedNextStep}`,
            ].join('\n'),
            createdAt: insights.createdAt,
            weightHints: {},
        });
    }
    const trimmedSnippet = clientTerminalSnippet?.trim();
    if (trimmedSnippet) {
        chunks.push({
            id: randomUUID(),
            kind: 'client_terminal',
            title: 'User-supplied terminal excerpt',
            content: clip(trimmedSnippet, 8000),
            weightHints: { pinned: true, severity: /error|failed|exception/i.test(trimmedSnippet) ? 'error' : 'info' },
        });
    }
    if (preferences.includeCommandHistory) {
        const commands = memory.getRecentCommands(10);
        if (commands.length > 0) {
            chunks.push({
                id: randomUUID(),
                kind: 'command_history',
                title: 'Recent commands',
                content: commands.map((c) => `- [${c.result}] ${clip(c.command, 160)}`).join('\n'),
                weightHints: {},
            });
        }
    }
    return { chunks, privacyNotes };
}
