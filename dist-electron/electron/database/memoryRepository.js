import { randomUUID } from 'node:crypto';
import { getDb } from './sqliteClient.js';
import { cosineSimilarity, createLocalEmbedding } from '../ai/localEmbeddings.js';
export function createMemoryRepository() {
    const db = getDb();
    const insert = db.prepare('INSERT INTO command_logs (id, command, result, created_at) VALUES (?, ?, ?, ?)');
    const getRecent = db.prepare('SELECT id, command, result, created_at as createdAt FROM command_logs ORDER BY created_at DESC LIMIT ?');
    const insertChatMessage = db.prepare('INSERT INTO chat_messages (id, role, content, created_at) VALUES (?, ?, ?, ?)');
    const insertTask = db.prepare('INSERT INTO tasks (id, title, intent, target, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const updateTask = db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?');
    const getRecentTasks = db.prepare('SELECT id, title, intent, target, status, created_at as createdAt, updated_at as updatedAt FROM tasks ORDER BY created_at DESC LIMIT ?');
    const insertActivityLog = db.prepare('INSERT INTO activity_logs (id, level, message, created_at) VALUES (?, ?, ?, ?)');
    const getRecentActivityLogs = db.prepare('SELECT id, level, message, created_at as createdAt FROM activity_logs ORDER BY created_at DESC LIMIT ?');
    const getRecentConversations = db.prepare('SELECT id, role, content, created_at as createdAt FROM chat_messages ORDER BY created_at DESC LIMIT ?');
    const upsertCommandMemory = db.prepare(`
    INSERT INTO command_memory (command, usage_count, last_used_at, is_favorite)
    VALUES (?, 1, ?, 0)
    ON CONFLICT(command) DO UPDATE SET
      usage_count = usage_count + 1,
      last_used_at = excluded.last_used_at
  `);
    const getCommandMemoryStats = db.prepare('SELECT command, usage_count as usageCount, last_used_at as lastUsedAt, is_favorite as isFavorite FROM command_memory ORDER BY usage_count DESC LIMIT ?');
    const getWorkflows = db.prepare('SELECT id, name, description, steps_json as stepsJson, created_at as createdAt, updated_at as updatedAt FROM workflows ORDER BY updated_at DESC');
    const insertWorkflow = db.prepare('INSERT INTO workflows (id, name, description, steps_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    const workflowCount = db.prepare('SELECT COUNT(*) as total FROM workflows');
    const getProjects = db.prepare('SELECT id, name, folder_path as folderPath, startup_commands_json as startupCommandsJson, applications_json as applicationsJson, updated_at as updatedAt FROM projects ORDER BY updated_at DESC');
    const insertProject = db.prepare('INSERT INTO projects (id, name, folder_path, startup_commands_json, applications_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    const projectCount = db.prepare('SELECT COUNT(*) as total FROM projects');
    const getSuggestions = db.prepare('SELECT id, message, confidence, created_at as createdAt FROM personalization_suggestions ORDER BY created_at DESC LIMIT ?');
    const insertSuggestion = db.prepare('INSERT INTO personalization_suggestions (id, message, confidence, created_at) VALUES (?, ?, ?, ?)');
    const suggestionCount = db.prepare('SELECT COUNT(*) as total FROM personalization_suggestions');
    const getWorkflowSchedules = db.prepare('SELECT id, workflow_id as workflowId, schedule_type as scheduleType, time_of_day as timeOfDay, day_of_week as dayOfWeek, run_at as runAt, is_enabled as isEnabled, last_run_at as lastRunAt, created_at as createdAt FROM workflow_schedules ORDER BY created_at DESC');
    const insertWorkflowSchedule = db.prepare('INSERT INTO workflow_schedules (id, workflow_id, schedule_type, time_of_day, day_of_week, run_at, is_enabled, last_run_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const updateScheduleLastRun = db.prepare('UPDATE workflow_schedules SET last_run_at = ? WHERE id = ?');
    const getWorkflowRuns = db.prepare('SELECT id, workflow_id as workflowId, workflow_name as workflowName, status, started_at as startedAt, completed_at as completedAt, message FROM workflow_runs ORDER BY started_at DESC LIMIT ?');
    const insertWorkflowRun = db.prepare('INSERT INTO workflow_runs (id, workflow_id, workflow_name, status, started_at, completed_at, message) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertScreenCapture = db.prepare('INSERT INTO screen_captures (id, image_base64, width, height, source, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const insertScreenAnalysis = db.prepare('INSERT INTO screen_analyses (id, summary, ocr_text, confidence, active_window_json, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const getRecentScreenAnalyses = db.prepare('SELECT id, summary, ocr_text as ocrText, confidence, active_window_json as activeWindowJson, created_at as createdAt FROM screen_analyses ORDER BY created_at DESC LIMIT ?');
    const insertAgentPlan = db.prepare('INSERT INTO agent_plans (id, goal, reasoning, state, steps_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const updateAgentPlanStateStmt = db.prepare('UPDATE agent_plans SET state = ?, updated_at = ? WHERE id = ?');
    const getAgentPlansStmt = db.prepare('SELECT id, goal, reasoning, state, steps_json as stepsJson, created_at as createdAt, updated_at as updatedAt FROM agent_plans ORDER BY created_at DESC LIMIT ?');
    const insertAgentRun = db.prepare('INSERT INTO agent_runs (id, plan_id, goal, state, started_at, completed_at, message) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const getAgentRunsStmt = db.prepare('SELECT id, plan_id as planId, goal, state, started_at as startedAt, completed_at as completedAt, message FROM agent_runs ORDER BY started_at DESC LIMIT ?');
    const upsertAiSetting = db.prepare(`
    INSERT INTO ai_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
    const getAiSettingsRows = db.prepare('SELECT key, value, updated_at as updatedAt FROM ai_settings');
    const insertAiProviderMetric = db.prepare('INSERT INTO ai_provider_logs (id, provider, model, latency_ms, input_chars, output_chars, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const getAiProviderMetricsStmt = db.prepare('SELECT provider, model, latency_ms as latencyMs, input_chars as inputChars, output_chars as outputChars, created_at as createdAt FROM ai_provider_logs ORDER BY created_at DESC LIMIT ?');
    const upsertMemoryEmbeddingStmt = db.prepare(`
    INSERT INTO memory_embeddings (id, kind, content, vector_json, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, content = excluded.content, vector_json = excluded.vector_json
  `);
    const getMemoryEmbeddingsStmt = db.prepare('SELECT id, kind, content, vector_json as vectorJson, created_at as createdAt FROM memory_embeddings ORDER BY created_at DESC LIMIT ?');
    const insertWorkspaceContextStmt = db.prepare('INSERT INTO workspace_context_logs (id, app, title, process_name, timestamp) VALUES (?, ?, ?, ?, ?)');
    const getLatestWorkspaceContextStmt = db.prepare('SELECT app, title, process_name as processName, timestamp FROM workspace_context_logs ORDER BY timestamp DESC LIMIT 1');
    const insertKnowledgeChunkStmt = db.prepare(`
    INSERT INTO knowledge_chunks (id, source_type, source_ref, content, metadata_json, embedding_json, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      source_type = excluded.source_type,
      source_ref = excluded.source_ref,
      content = excluded.content,
      metadata_json = excluded.metadata_json,
      embedding_json = excluded.embedding_json,
      indexed_at = excluded.indexed_at
  `);
    const clearKnowledgeChunksStmt = db.prepare('DELETE FROM knowledge_chunks');
    const getKnowledgeChunksStmt = db.prepare('SELECT id, source_type as sourceType, source_ref as sourceRef, content, metadata_json as metadataJson, embedding_json as embeddingJson, indexed_at as indexedAt FROM knowledge_chunks ORDER BY indexed_at DESC LIMIT ?');
    const upsertKnowledgeGraphEdgeStmt = db.prepare(`
    INSERT INTO knowledge_graph_edges (id, from_node_id, to_node_id, relation, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      from_node_id = excluded.from_node_id,
      to_node_id = excluded.to_node_id,
      relation = excluded.relation,
      updated_at = excluded.updated_at
  `);
    const clearKnowledgeGraphEdgesStmt = db.prepare('DELETE FROM knowledge_graph_edges');
    const getKnowledgeGraphEdgesStmt = db.prepare('SELECT id, from_node_id as fromNodeId, to_node_id as toNodeId, relation FROM knowledge_graph_edges ORDER BY updated_at DESC LIMIT ?');
    const insertObservabilityEventStmt = db.prepare('INSERT INTO observability_events (id, type, source, severity, title, message, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const getRecentObservabilityEventsStmt = db.prepare('SELECT id, type, source, severity, title, message, metadata_json as metadataJson, created_at as createdAt FROM observability_events ORDER BY created_at DESC LIMIT ?');
    const insertProactiveNotificationStmt = db.prepare('INSERT INTO proactive_notifications (id, level, title, message, event_id, action_label, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const getRecentProactiveNotificationsStmt = db.prepare('SELECT id, level, title, message, event_id as eventId, action_label as actionLabel, created_at as createdAt, read_at as readAt FROM proactive_notifications ORDER BY created_at DESC LIMIT ?');
    const markProactiveNotificationReadStmt = db.prepare('UPDATE proactive_notifications SET read_at = ? WHERE id = ?');
    const insertLearningFeedbackStmt = db.prepare('INSERT INTO learning_feedback (id, type, source, action, outcome, score, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const getLearningFeedbackStmt = db.prepare('SELECT id, type, source, action, outcome, score, metadata_json as metadataJson, created_at as createdAt FROM learning_feedback ORDER BY created_at DESC LIMIT ?');
    const upsertBehaviorPatternStmt = db.prepare(`
    INSERT INTO behavior_patterns (id, name, description, category, confidence, frequency, last_seen_at, related_actions_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      category = excluded.category,
      confidence = excluded.confidence,
      frequency = excluded.frequency,
      last_seen_at = excluded.last_seen_at,
      related_actions_json = excluded.related_actions_json
  `);
    const getBehaviorPatternsStmt = db.prepare('SELECT id, name, description, category, confidence, frequency, last_seen_at as lastSeenAt, related_actions_json as relatedActionsJson FROM behavior_patterns ORDER BY confidence DESC, frequency DESC LIMIT ?');
    const insertAdaptiveRecommendationStmt = db.prepare('INSERT INTO adaptive_recommendations (id, title, message, category, confidence, impact_score, source_pattern_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const getAdaptiveRecommendationsStmt = db.prepare('SELECT id, title, message, category, confidence, impact_score as impactScore, source_pattern_id as sourcePatternId, status, created_at as createdAt FROM adaptive_recommendations ORDER BY created_at DESC LIMIT ?');
    const setAdaptiveRecommendationStatusStmt = db.prepare('UPDATE adaptive_recommendations SET status = ? WHERE id = ?');
    const insertWorkflowOptimizationInsightStmt = db.prepare('INSERT INTO workflow_optimization_insights (id, workflow_id, workflow_name, issue, suggestion, confidence, estimated_impact, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const getWorkflowOptimizationInsightsStmt = db.prepare('SELECT id, workflow_id as workflowId, workflow_name as workflowName, issue, suggestion, confidence, estimated_impact as estimatedImpact, created_at as createdAt FROM workflow_optimization_insights ORDER BY created_at DESC LIMIT ?');
    function deserializeWorkflow(row) {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            steps: JSON.parse(row.stepsJson),
        };
    }
    function deserializeProject(row) {
        return {
            id: row.id,
            name: row.name,
            folderPath: row.folderPath,
            startupCommands: JSON.parse(row.startupCommandsJson),
            applications: JSON.parse(row.applicationsJson),
            updatedAt: row.updatedAt,
        };
    }
    return {
        addCommandLog(command, result) {
            const id = randomUUID();
            const now = new Date().toISOString();
            insert.run(id, command, result, now);
            this.upsertMemoryEmbedding({ id, kind: 'command', content: command, vector: createLocalEmbedding(command), createdAt: now });
            upsertCommandMemory.run(command, now);
            return id;
        },
        getRecentCommands(limit = 20) {
            return getRecent.all(limit);
        },
        addChatMessage(message) {
            const now = new Date().toISOString();
            const created = {
                id: randomUUID(),
                role: message.role,
                content: message.content,
                createdAt: now,
            };
            insertChatMessage.run(created.id, created.role, created.content, created.createdAt);
            this.upsertMemoryEmbedding({
                id: created.id,
                kind: 'chat',
                content: created.content,
                vector: createLocalEmbedding(created.content),
                createdAt: created.createdAt,
            });
            return created;
        },
        addTask(task) {
            const now = new Date().toISOString();
            const created = {
                id: randomUUID(),
                title: task.title,
                intent: task.intent,
                target: task.target,
                status: task.status,
                createdAt: now,
                updatedAt: now,
            };
            insertTask.run(created.id, created.title, created.intent, created.target, created.status, created.createdAt, created.updatedAt);
            return created;
        },
        updateTaskStatus(id, status) {
            updateTask.run(status, new Date().toISOString(), id);
        },
        getRecentTasks(limit = 30) {
            return getRecentTasks.all(limit);
        },
        addActivityLog(level, message) {
            const created = {
                id: randomUUID(),
                level,
                message,
                createdAt: new Date().toISOString(),
            };
            insertActivityLog.run(created.id, created.level, created.message, created.createdAt);
            return created;
        },
        getRecentActivityLogs(limit = 100) {
            return getRecentActivityLogs.all(limit);
        },
        getRecentConversations(limit = 24) {
            return getRecentConversations.all(limit);
        },
        upsertCommandMemory(command) {
            upsertCommandMemory.run(command, new Date().toISOString());
        },
        getCommandMemoryStats(limit = 20) {
            return getCommandMemoryStats.all(limit).map((item) => ({ ...item, isFavorite: item.isFavorite === 1 }));
        },
        getWorkflows() {
            return getWorkflows.all().map(deserializeWorkflow);
        },
        getProjects() {
            return getProjects.all().map(deserializeProject);
        },
        getPersonalizationSuggestions(limit = 12) {
            return getSuggestions.all(limit);
        },
        createMemoryOverview() {
            return {
                recentConversations: this.getRecentConversations(8),
                commandStats: this.getCommandMemoryStats(8),
                workflows: this.getWorkflows(),
                projects: this.getProjects(),
                suggestions: this.getPersonalizationSuggestions(6),
            };
        },
        saveWorkflow(workflow) {
            insertWorkflow.run(workflow.id, workflow.name, workflow.description, JSON.stringify(workflow.steps), workflow.createdAt, workflow.updatedAt);
            this.upsertMemoryEmbedding({
                id: workflow.id,
                kind: 'workflow',
                content: `${workflow.name} ${workflow.description}`,
                vector: createLocalEmbedding(`${workflow.name} ${workflow.description}`),
                createdAt: workflow.createdAt,
            });
        },
        addWorkflowRun(run) {
            const created = { ...run, id: randomUUID() };
            insertWorkflowRun.run(created.id, created.workflowId, created.workflowName, created.status, created.startedAt, created.completedAt, created.message);
            return created;
        },
        getWorkflowRuns(limit = 40) {
            return getWorkflowRuns.all(limit);
        },
        getWorkflowSchedules() {
            return getWorkflowSchedules.all().map((item) => ({ ...item, isEnabled: item.isEnabled === 1 }));
        },
        updateWorkflowScheduleLastRun(id, lastRunAt) {
            updateScheduleLastRun.run(lastRunAt, id);
        },
        generateWorkflowFromPrompt(prompt) {
            const normalized = prompt.toLowerCase();
            const now = new Date().toISOString();
            const name = normalized.includes('design')
                ? 'Design Setup'
                : normalized.includes('meeting')
                    ? 'Client Meeting Setup'
                    : normalized.includes('content')
                        ? 'Content Creation Setup'
                        : 'Development Setup';
            const steps = normalized.includes('design')
                ? [
                    { id: randomUUID(), type: 'open_application', payload: 'Figma', order: 1 },
                    { id: randomUUID(), type: 'open_url', payload: 'https://dribbble.com', order: 2 },
                ]
                : normalized.includes('meeting')
                    ? [
                        { id: randomUUID(), type: 'open_application', payload: 'Chrome', order: 1 },
                        { id: randomUUID(), type: 'open_url', payload: 'https://calendar.google.com', order: 2 },
                    ]
                    : normalized.includes('content')
                        ? [
                            { id: randomUUID(), type: 'open_application', payload: 'VS Code', order: 1 },
                            { id: randomUUID(), type: 'open_url', payload: 'https://notion.so', order: 2 },
                        ]
                        : [
                            { id: randomUUID(), type: 'open_application', payload: 'VS Code', order: 1 },
                            { id: randomUUID(), type: 'run_terminal', payload: 'npm run dev', order: 2 },
                        ];
            const workflow = {
                id: randomUUID(),
                name,
                description: `Generated from prompt: ${prompt}`,
                createdAt: now,
                updatedAt: now,
                steps,
            };
            this.saveWorkflow(workflow);
            return workflow;
        },
        addScreenCapture(capture) {
            insertScreenCapture.run(capture.id, capture.imageBase64, capture.width, capture.height, capture.source, capture.createdAt);
        },
        addScreenAnalysis(analysis) {
            insertScreenAnalysis.run(analysis.id, analysis.summary, analysis.ocrText, analysis.confidence, analysis.activeWindow ? JSON.stringify(analysis.activeWindow) : null, analysis.createdAt);
        },
        getRecentScreenAnalyses(limit = 24) {
            return getRecentScreenAnalyses.all(limit).map((item) => ({
                id: item.id,
                summary: item.summary,
                ocrText: item.ocrText,
                confidence: item.confidence,
                activeWindow: item.activeWindowJson ? JSON.parse(item.activeWindowJson) : null,
                createdAt: item.createdAt,
            }));
        },
        saveAgentPlan(plan) {
            insertAgentPlan.run(plan.id, plan.goal, plan.reasoning, plan.state, JSON.stringify(plan.steps), plan.createdAt, plan.updatedAt);
        },
        updateAgentPlanState(id, state) {
            updateAgentPlanStateStmt.run(state, new Date().toISOString(), id);
        },
        getAgentPlans(limit = 30) {
            return getAgentPlansStmt.all(limit).map((item) => ({
                id: item.id,
                goal: item.goal,
                reasoning: item.reasoning,
                state: item.state,
                steps: JSON.parse(item.stepsJson),
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            }));
        },
        addAgentRun(run) {
            const created = { ...run, id: randomUUID() };
            insertAgentRun.run(created.id, created.planId, created.goal, created.state, created.startedAt, created.completedAt, created.message);
            return created;
        },
        getAgentRuns(limit = 60) {
            return getAgentRunsStmt.all(limit);
        },
        getAiSettings() {
            const rows = getAiSettingsRows.all();
            const map = new Map(rows.map((row) => [row.key, row]));
            const updatedAt = rows[0]?.updatedAt ?? new Date().toISOString();
            return {
                preferredProvider: map.get('preferredProvider')?.value ?? 'ollama',
                offlineMode: map.get('offlineMode')?.value === 'true',
                localModel: map.get('localModel')?.value ?? 'llama3',
                cloudModel: map.get('cloudModel')?.value ?? 'gpt-4o-mini',
                reasoningThreshold: Number(map.get('reasoningThreshold')?.value ?? '220'),
                updatedAt,
            };
        },
        saveAiSettings(settings) {
            const current = this.getAiSettings();
            const next = {
                ...current,
                ...settings,
                updatedAt: new Date().toISOString(),
            };
            upsertAiSetting.run('preferredProvider', next.preferredProvider, next.updatedAt);
            upsertAiSetting.run('offlineMode', String(next.offlineMode), next.updatedAt);
            upsertAiSetting.run('localModel', next.localModel, next.updatedAt);
            upsertAiSetting.run('cloudModel', next.cloudModel, next.updatedAt);
            upsertAiSetting.run('reasoningThreshold', String(next.reasoningThreshold), next.updatedAt);
            return next;
        },
        addAiProviderMetric(metric) {
            insertAiProviderMetric.run(randomUUID(), metric.provider, metric.model, metric.latencyMs, metric.inputChars, metric.outputChars, metric.createdAt);
        },
        getAiProviderMetrics(limit = 120) {
            return getAiProviderMetricsStmt.all(limit);
        },
        upsertMemoryEmbedding(entry) {
            upsertMemoryEmbeddingStmt.run(entry.id, entry.kind, entry.content, JSON.stringify(entry.vector), entry.createdAt);
        },
        semanticSearch(query, limit = 8) {
            const queryVector = createLocalEmbedding(query);
            const rows = getMemoryEmbeddingsStmt.all(300);
            return rows
                .map((item) => ({
                id: item.id,
                kind: item.kind,
                content: item.content,
                score: cosineSimilarity(queryVector, JSON.parse(item.vectorJson)),
                createdAt: item.createdAt,
            }))
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        },
        getOverlayState() {
            const rows = getAiSettingsRows.all();
            const map = new Map(rows.map((row) => [row.key, row]));
            return {
                visible: map.get('overlayVisible')?.value === 'true',
                docked: map.get('overlayDocked')?.value !== 'false',
                voiceMode: map.get('overlayVoiceMode')?.value === 'true',
                quickAutomation: map.get('overlayQuickAutomation')?.value === 'true',
                updatedAt: map.get('overlayUpdatedAt')?.value ?? new Date().toISOString(),
            };
        },
        saveOverlayState(state) {
            const current = this.getOverlayState();
            const next = {
                ...current,
                ...state,
                updatedAt: new Date().toISOString(),
            };
            upsertAiSetting.run('overlayVisible', String(next.visible), next.updatedAt);
            upsertAiSetting.run('overlayDocked', String(next.docked), next.updatedAt);
            upsertAiSetting.run('overlayVoiceMode', String(next.voiceMode), next.updatedAt);
            upsertAiSetting.run('overlayQuickAutomation', String(next.quickAutomation), next.updatedAt);
            upsertAiSetting.run('overlayUpdatedAt', next.updatedAt, next.updatedAt);
            return next;
        },
        getShortcutBindings() {
            const rows = getAiSettingsRows.all();
            const map = new Map(rows.map((row) => [row.key, row]));
            return {
                toggleOverlay: map.get('shortcutToggleOverlay')?.value ?? 'CommandOrControl+Space',
                toggleVoice: map.get('shortcutToggleVoice')?.value ?? 'CommandOrControl+Shift+J',
                quickAutomation: map.get('shortcutQuickAutomation')?.value ?? 'CommandOrControl+Shift+A',
            };
        },
        saveShortcutBindings(bindings) {
            const current = this.getShortcutBindings();
            const next = { ...current, ...bindings };
            const now = new Date().toISOString();
            upsertAiSetting.run('shortcutToggleOverlay', next.toggleOverlay, now);
            upsertAiSetting.run('shortcutToggleVoice', next.toggleVoice, now);
            upsertAiSetting.run('shortcutQuickAutomation', next.quickAutomation, now);
            return next;
        },
        addWorkspaceContext(context) {
            insertWorkspaceContextStmt.run(randomUUID(), context.app, context.title, context.processName, context.timestamp);
        },
        getLatestWorkspaceContext() {
            const row = getLatestWorkspaceContextStmt.get();
            return row ?? null;
        },
        setSkillEnabled(skillId, enabled) {
            const now = new Date().toISOString();
            upsertAiSetting.run(`skill.${skillId}.enabled`, String(enabled), now);
        },
        getSkillEnabledStates() {
            const rows = getAiSettingsRows.all();
            const map = new Map();
            for (const row of rows) {
                if (!row.key.startsWith('skill.') || !row.key.endsWith('.enabled'))
                    continue;
                const skillId = row.key.replace('skill.', '').replace('.enabled', '');
                map.set(skillId, row.value === 'true');
            }
            return map;
        },
        indexKnowledgeChunk(chunk, vector) {
            insertKnowledgeChunkStmt.run(chunk.id, chunk.sourceType, chunk.sourceRef, chunk.content, JSON.stringify(chunk.metadata), JSON.stringify(vector ?? createLocalEmbedding(chunk.content)), chunk.indexedAt);
        },
        clearKnowledgeIndex() {
            clearKnowledgeChunksStmt.run();
            clearKnowledgeGraphEdgesStmt.run();
            this.setIndexingStatus({
                isRunning: false,
                indexedChunkCount: 0,
                lastIndexedAt: null,
            });
        },
        semanticKnowledgeSearch(query, limit = 10, filter) {
            const queryVector = createLocalEmbedding(query);
            const rows = getKnowledgeChunksStmt.all(1200);
            const from = filter?.fromDate ? new Date(filter.fromDate).getTime() : null;
            const to = filter?.toDate ? new Date(filter.toDate).getTime() : null;
            return rows
                .filter((item) => {
                if (filter?.sourceTypes && filter.sourceTypes.length > 0 && !filter.sourceTypes.includes(item.sourceType)) {
                    return false;
                }
                const ts = new Date(item.indexedAt).getTime();
                if (from !== null && ts < from)
                    return false;
                if (to !== null && ts > to)
                    return false;
                return true;
            })
                .map((item) => ({
                chunk: {
                    id: item.id,
                    sourceType: item.sourceType,
                    sourceRef: item.sourceRef,
                    content: item.content,
                    metadata: JSON.parse(item.metadataJson),
                    indexedAt: item.indexedAt,
                },
                score: cosineSimilarity(queryVector, JSON.parse(item.embeddingJson)),
            }))
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        },
        upsertKnowledgeGraphEdge(edge) {
            const id = `${edge.fromNodeId}:${edge.relation}:${edge.toNodeId}`;
            upsertKnowledgeGraphEdgeStmt.run(id, edge.fromNodeId, edge.toNodeId, edge.relation, new Date().toISOString());
        },
        getKnowledgeGraphSnapshot(limit = 300) {
            const edges = getKnowledgeGraphEdgesStmt.all(limit);
            const nodeMap = new Map();
            const addNode = (id) => {
                if (nodeMap.has(id))
                    return;
                const [type] = id.split(':');
                const normalizedType = type === 'workflow' || type === 'command' || type === 'project' || type === 'conversation' || type === 'file'
                    ? type
                    : 'conversation';
                nodeMap.set(id, { id, type: normalizedType, label: id.replace(`${type}:`, '') });
            };
            for (const edge of edges) {
                addNode(edge.fromNodeId);
                addNode(edge.toNodeId);
            }
            return {
                nodes: Array.from(nodeMap.values()),
                edges,
                updatedAt: new Date().toISOString(),
            };
        },
        getIndexingStatus() {
            const rows = getAiSettingsRows.all();
            const map = new Map(rows.map((row) => [row.key, row.value]));
            const lastIndexedAt = map.get('knowledge.indexing.lastIndexedAt');
            return {
                isRunning: map.get('knowledge.indexing.isRunning') === 'true',
                lastIndexedAt: lastIndexedAt && lastIndexedAt.length > 0 ? lastIndexedAt : null,
                indexedChunkCount: Number(map.get('knowledge.indexing.indexedChunkCount') ?? '0'),
            };
        },
        setIndexingStatus(status) {
            const current = this.getIndexingStatus();
            const next = {
                isRunning: status.isRunning ?? current.isRunning,
                lastIndexedAt: status.lastIndexedAt ?? current.lastIndexedAt,
                indexedChunkCount: status.indexedChunkCount ?? current.indexedChunkCount,
            };
            const now = new Date().toISOString();
            upsertAiSetting.run('knowledge.indexing.isRunning', String(next.isRunning), now);
            upsertAiSetting.run('knowledge.indexing.lastIndexedAt', next.lastIndexedAt ?? '', now);
            upsertAiSetting.run('knowledge.indexing.indexedChunkCount', String(next.indexedChunkCount), now);
            return next;
        },
        addObservabilityEvent(event) {
            const created = {
                id: randomUUID(),
                ...event,
            };
            insertObservabilityEventStmt.run(created.id, created.type, created.source, created.severity, created.title, created.message, JSON.stringify(created.metadata), created.createdAt);
            this.indexKnowledgeChunk({
                id: `event:${created.id}`,
                sourceType: 'activity',
                sourceRef: created.id,
                content: `${created.title} ${created.message}`,
                metadata: { eventType: created.type, severity: created.severity },
                indexedAt: created.createdAt,
            });
            return created;
        },
        getRecentObservabilityEvents(limit = 120) {
            return getRecentObservabilityEventsStmt.all(limit).map((item) => ({
                ...item,
                metadata: JSON.parse(item.metadataJson),
            }));
        },
        addProactiveNotification(notification) {
            const created = {
                id: randomUUID(),
                level: notification.level,
                title: notification.title,
                message: notification.message,
                eventId: notification.eventId,
                actionLabel: notification.actionLabel,
                createdAt: notification.createdAt,
                readAt: notification.readAt ?? null,
            };
            insertProactiveNotificationStmt.run(created.id, created.level, created.title, created.message, created.eventId, created.actionLabel, created.createdAt, created.readAt);
            return created;
        },
        getRecentProactiveNotifications(limit = 80) {
            return getRecentProactiveNotificationsStmt.all(limit);
        },
        markProactiveNotificationRead(notificationId) {
            markProactiveNotificationReadStmt.run(new Date().toISOString(), notificationId);
        },
        getObservabilitySnapshot() {
            const events = this.getRecentObservabilityEvents(80);
            const notifications = this.getRecentProactiveNotifications(40);
            return {
                events,
                notifications,
                activeAlerts: notifications.filter((item) => item.readAt === null && item.level !== 'info').length,
                updatedAt: new Date().toISOString(),
            };
        },
        addLearningFeedback(feedback) {
            const created = {
                id: randomUUID(),
                ...feedback,
            };
            insertLearningFeedbackStmt.run(created.id, created.type, created.source, created.action, created.outcome, created.score, JSON.stringify(created.metadata), created.createdAt);
            return created;
        },
        getLearningFeedback(limit = 200) {
            return getLearningFeedbackStmt.all(limit).map((item) => ({
                id: item.id,
                type: item.type,
                source: item.source,
                action: item.action,
                outcome: item.outcome,
                score: item.score,
                metadata: JSON.parse(item.metadataJson),
                createdAt: item.createdAt,
            }));
        },
        upsertBehaviorPattern(pattern) {
            upsertBehaviorPatternStmt.run(pattern.id, pattern.name, pattern.description, pattern.category, pattern.confidence, pattern.frequency, pattern.lastSeenAt, JSON.stringify(pattern.relatedActions));
        },
        getBehaviorPatterns(limit = 50) {
            return getBehaviorPatternsStmt.all(limit).map((item) => ({
                ...item,
                relatedActions: JSON.parse(item.relatedActionsJson),
            }));
        },
        addAdaptiveRecommendation(recommendation) {
            const created = {
                id: randomUUID(),
                ...recommendation,
            };
            insertAdaptiveRecommendationStmt.run(created.id, created.title, created.message, created.category, created.confidence, created.impactScore, created.sourcePatternId, created.status, created.createdAt);
            return created;
        },
        getAdaptiveRecommendations(limit = 60) {
            return getAdaptiveRecommendationsStmt.all(limit);
        },
        setRecommendationStatus(id, status) {
            setAdaptiveRecommendationStatusStmt.run(status, id);
            const feedbackType = status === 'accepted' ? 'recommendation_accepted' : 'recommendation_dismissed';
            this.addLearningFeedback({
                type: feedbackType,
                source: 'overlay',
                action: 'recommendation_feedback',
                outcome: status === 'accepted' ? 'success' : 'neutral',
                score: status === 'accepted' ? 1 : 0.2,
                metadata: { recommendationId: id, status },
                createdAt: new Date().toISOString(),
            });
        },
        addWorkflowOptimizationInsight(insight) {
            const created = {
                id: randomUUID(),
                ...insight,
            };
            insertWorkflowOptimizationInsightStmt.run(created.id, created.workflowId, created.workflowName, created.issue, created.suggestion, created.confidence, created.estimatedImpact, created.createdAt);
            return created;
        },
        getWorkflowOptimizationInsights(limit = 60) {
            return getWorkflowOptimizationInsightsStmt.all(limit);
        },
        getLearningSnapshot() {
            const feedback = this.getLearningFeedback(80);
            const patterns = this.getBehaviorPatterns(20);
            const recommendations = this.getAdaptiveRecommendations(30);
            const optimizations = this.getWorkflowOptimizationInsights(20);
            const adaptationScore = feedback.length === 0
                ? 0
                : Math.round((feedback.reduce((acc, item) => acc + item.score, 0) / feedback.length) * 100);
            return {
                feedback,
                patterns,
                recommendations,
                optimizations,
                adaptationScore,
                updatedAt: new Date().toISOString(),
            };
        },
        createDefaultMemoriesIfNeeded() {
            const now = new Date().toISOString();
            const workflowTotal = workflowCount.get();
            if (workflowTotal.total === 0) {
                const baseWorkflows = [
                    {
                        id: randomUUID(),
                        name: 'Development Mode',
                        description: 'Open workspace and start development services.',
                        createdAt: now,
                        updatedAt: now,
                        steps: [
                            { id: randomUUID(), type: 'open_application', payload: 'VS Code', order: 1 },
                            { id: randomUUID(), type: 'run_terminal', payload: 'npm run dev', order: 2 },
                        ],
                    },
                    {
                        id: randomUUID(),
                        name: 'Design Mode',
                        description: 'Launch design stack and references.',
                        createdAt: now,
                        updatedAt: now,
                        steps: [
                            { id: randomUUID(), type: 'open_application', payload: 'Figma', order: 1 },
                            { id: randomUUID(), type: 'open_url', payload: 'https://dribbble.com', order: 2 },
                        ],
                    },
                ];
                for (const workflow of baseWorkflows) {
                    insertWorkflow.run(workflow.id, workflow.name, workflow.description, JSON.stringify(workflow.steps), workflow.createdAt, workflow.updatedAt);
                }
            }
            const scheduleTotal = db.prepare('SELECT COUNT(*) as total FROM workflow_schedules').get().total;
            if (scheduleTotal === 0) {
                const workflows = this.getWorkflows();
                const devWorkflow = workflows.find((item) => item.name.toLowerCase().includes('development'));
                if (devWorkflow) {
                    insertWorkflowSchedule.run(randomUUID(), devWorkflow.id, 'daily', '09:00', null, null, 1, null, now);
                }
            }
            const projectTotal = projectCount.get();
            if (projectTotal.total === 0) {
                insertProject.run(randomUUID(), 'JARVIS AI Desktop Assistant', process.cwd(), JSON.stringify(['npm run dev']), JSON.stringify(['VS Code', 'Chrome']), now);
            }
            const suggestionTotal = suggestionCount.get();
            if (suggestionTotal.total === 0) {
                insertSuggestion.run(randomUUID(), 'You often launch VS Code before running npm dev.', 0.82, now);
                insertSuggestion.run(randomUUID(), 'You usually check system usage after starting workflows.', 0.67, now);
            }
            const aiSettingsRows = getAiSettingsRows.all();
            if (aiSettingsRows.length === 0) {
                this.saveAiSettings({
                    preferredProvider: 'ollama',
                    offlineMode: false,
                    localModel: 'llama3',
                    cloudModel: 'gpt-4o-mini',
                    reasoningThreshold: 220,
                });
                this.saveOverlayState({
                    visible: false,
                    docked: true,
                    voiceMode: false,
                    quickAutomation: false,
                });
                this.saveShortcutBindings({
                    toggleOverlay: 'CommandOrControl+Space',
                    toggleVoice: 'CommandOrControl+Shift+J',
                    quickAutomation: 'CommandOrControl+Shift+A',
                });
            }
        },
    };
}
