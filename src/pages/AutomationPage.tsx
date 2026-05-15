import { useEffect } from 'react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { useAgentStore } from '@/store/agentStore'
import { useAutomationStore } from '@/store/automationStore'
import { useExecutionStore } from '@/store/executionStore'
import { useLearningStore } from '@/store/learningStore'
import { useMultiAgentStore } from '@/store/multiAgentStore'
import { useObservabilityStore } from '@/store/observabilityStore'
import { useProductivityStore } from '@/store/productivityStore'

export function AutomationPage() {
  const tasks = useExecutionStore((state) => state.tasks)
  const loadExecutionData = useExecutionStore((state) => state.loadExecutionData)
  const initializeExecutionListener = useExecutionStore((state) => state.initializeExecutionListener)
  const workflows = useAutomationStore((state) => state.workflows)
  const schedules = useAutomationStore((state) => state.schedules)
  const runs = useAutomationStore((state) => state.runs)
  const generatedPrompt = useAutomationStore((state) => state.generatedPrompt)
  const setGeneratedPrompt = useAutomationStore((state) => state.setGeneratedPrompt)
  const isLoading = useAutomationStore((state) => state.isLoading)
  const error = useAutomationStore((state) => state.error)
  const executeWorkflow = useAutomationStore((state) => state.executeWorkflow)
  const loadAutomationData = useAutomationStore((state) => state.loadAutomationData)
  const generateWorkflow = useAutomationStore((state) => state.generateWorkflow)
  const goalInput = useAgentStore((state) => state.goalInput)
  const setGoalInput = useAgentStore((state) => state.setGoalInput)
  const plans = useAgentStore((state) => state.plans)
  const agentRuns = useAgentStore((state) => state.runs)
  const isPlanning = useAgentStore((state) => state.isPlanning)
  const isExecuting = useAgentStore((state) => state.isExecuting)
  const agentError = useAgentStore((state) => state.error)
  const loadAgentData = useAgentStore((state) => state.loadAgentData)
  const planGoal = useAgentStore((state) => state.planGoal)
  const executePlan = useAgentStore((state) => state.executePlan)
  const taskPrompt = useProductivityStore((state) => state.taskPrompt)
  const setTaskPrompt = useProductivityStore((state) => state.setTaskPrompt)
  const generatedTasks = useProductivityStore((state) => state.generatedTasks)
  const generateTasks = useProductivityStore((state) => state.generateTasks)
  const multiAgentGoal = useMultiAgentStore((state) => state.goalInput)
  const setMultiAgentGoal = useMultiAgentStore((state) => state.setGoalInput)
  const multiAgentSessions = useMultiAgentStore((state) => state.sessions)
  const multiAgentPerformance = useMultiAgentStore((state) => state.performance)
  const isMultiAgentRunning = useMultiAgentStore((state) => state.isRunning)
  const multiAgentError = useMultiAgentStore((state) => state.error)
  const loadMultiAgentState = useMultiAgentStore((state) => state.loadMultiAgentState)
  const runMultiAgentGoal = useMultiAgentStore((state) => state.runGoal)
  const notifications = useObservabilityStore((state) => state.notifications)
  const loadObservability = useObservabilityStore((state) => state.loadObservability)
  const recommendations = useLearningStore((state) => state.recommendations)
  const optimizations = useLearningStore((state) => state.optimizations)
  const refreshLearning = useLearningStore((state) => state.refreshLearning)
  const setRecommendationStatus = useLearningStore((state) => state.setRecommendationStatus)
  const loadLearning = useLearningStore((state) => state.loadLearning)

  useEffect(() => {
    initializeExecutionListener()
    void loadExecutionData()
    void loadAutomationData()
    void loadAgentData()
    void loadMultiAgentState()
    void loadObservability()
    void loadLearning()
  }, [
    initializeExecutionListener,
    loadExecutionData,
    loadAutomationData,
    loadAgentData,
    loadMultiAgentState,
    loadObservability,
    loadLearning,
  ])

  return (
    <GlassPanel className="min-h-[70vh]">
      <h3 className="text-lg font-semibold text-white">Automation Workflows</h3>
      <p className="mt-2 text-sm text-white/60">Live workflow tasks and execution pipeline statuses.</p>
      {isLoading && <p className="mt-2 text-xs text-amber-300">Refreshing automation state...</p>}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/45">AI Goal Planning</p>
        <div className="mt-2 flex gap-2">
          <input
            value={goalInput}
            onChange={(event) => setGoalInput(event.target.value)}
            placeholder="Prepare my development environment"
            className="h-10 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/40"
          />
          <button
            onClick={() => void planGoal()}
            className="rounded-lg border border-amber-300/30 bg-amber-500/20 px-3 text-xs text-amber-200 hover:bg-amber-500/30"
          >
            {isPlanning ? 'Planning...' : 'Plan Goal'}
          </button>
        </div>
        {agentError && <p className="mt-2 text-xs text-red-300">{agentError}</p>}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/45">AI Dev Task Generation</p>
        <div className="mt-2 flex gap-2">
          <input
            value={taskPrompt}
            onChange={(event) => setTaskPrompt(event.target.value)}
            placeholder="Break this dashboard feature into implementation tasks"
            className="h-10 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/40"
          />
          <button
            onClick={() => void generateTasks()}
            className="rounded-lg border border-amber-300/30 bg-amber-500/20 px-3 text-xs text-amber-200 hover:bg-amber-500/30"
          >
            Generate Tasks
          </button>
        </div>
        {generatedTasks.length > 0 && (
          <div className="mt-2 space-y-1">
            {generatedTasks.slice(0, 4).map((task) => (
              <p key={task.id} className="text-xs text-white/75">
                [{task.priority}] {task.title}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/45">Multi-Agent Collaboration</p>
        <div className="mt-2 flex gap-2">
          <input
            value={multiAgentGoal}
            onChange={(event) => setMultiAgentGoal(event.target.value)}
            placeholder="Analyze dashboard and generate implementation plan"
            className="h-10 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/40"
          />
          <button
            onClick={() => void runMultiAgentGoal()}
            className="rounded-lg border border-amber-300/30 bg-amber-500/20 px-3 text-xs text-amber-200 hover:bg-amber-500/30"
          >
            {isMultiAgentRunning ? 'Running...' : 'Run Agents'}
          </button>
        </div>
        {multiAgentError && <p className="mt-2 text-xs text-red-300">{multiAgentError}</p>}
        {multiAgentPerformance.length > 0 && (
          <p className="mt-2 text-xs text-white/65">
            {multiAgentPerformance
              .slice(0, 3)
              .map((item) => `${item.agentId}:${item.avgLatencyMs}ms`)
              .join(' | ')}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/45">AI Workflow Generation</p>
        <div className="mt-2 flex gap-2">
          <input
            value={generatedPrompt}
            onChange={(event) => setGeneratedPrompt(event.target.value)}
            placeholder="Create a development setup workflow"
            className="h-10 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/40"
          />
          <button
            onClick={() => void generateWorkflow()}
            className="rounded-lg border border-amber-300/30 bg-amber-500/20 px-3 text-xs text-amber-200 hover:bg-amber-500/30"
          >
            Generate
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/45">Agent Plans</p>
        {plans.slice(0, 6).map((plan) => (
          <button
            key={plan.id}
            onClick={() => void executePlan(plan.id)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left hover:border-amber-300/40"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/85">{plan.goal}</p>
              <span className="text-xs uppercase text-amber-300">{plan.state}</span>
            </div>
            <p className="mt-1 text-xs text-white/45">{plan.steps.length} planned steps</p>
          </button>
        ))}
        {isExecuting && <p className="text-xs text-amber-300">Executing plan...</p>}
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/45">Saved Workflows</p>
        {workflows.slice(0, 10).map((workflow) => (
          <button
            key={workflow.id}
            onClick={() => void executeWorkflow(workflow.id)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left hover:border-amber-300/40"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/85">{workflow.name}</p>
              <span className="text-xs text-amber-300">{workflow.steps.length} steps</span>
            </div>
            <p className="mt-1 text-xs text-white/45">{workflow.description}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Schedules</p>
          {schedules.slice(0, 8).map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between text-xs text-white/75">
              <span>{schedule.scheduleType}</span>
              <span className="text-amber-300">{schedule.timeOfDay ?? schedule.runAt ?? 'manual'}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Workflow History</p>
          {runs.slice(0, 8).map((run) => (
            <div key={run.id} className="flex items-center justify-between text-xs text-white/75">
              <span>{run.workflowName}</span>
              <span className="uppercase text-amber-300">{run.status}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/45">Agent Execution History</p>
        {agentRuns.slice(0, 6).map((run) => (
          <div key={run.id} className="mt-2 flex items-center justify-between text-xs text-white/75">
            <span>{run.goal}</span>
            <span className="uppercase text-amber-300">{run.state}</span>
          </div>
        ))}
      </div>
      {multiAgentSessions.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Multi-Agent Session Timeline</p>
          {multiAgentSessions.slice(0, 4).map((session) => (
            <div key={session.id} className="mt-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1">
              <p className="text-xs text-white/80">{session.goal}</p>
              <p className="text-[11px] uppercase text-amber-300">{session.status}</p>
            </div>
          ))}
        </div>
      )}
      {notifications.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/45">Automation Alerts</p>
          {notifications.slice(0, 4).map((notification) => (
            <p key={notification.id} className="mt-1 text-xs text-white/75">
              {notification.title}: {notification.message}
            </p>
          ))}
        </div>
      )}
      {(recommendations.length > 0 || optimizations.length > 0) && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">Adaptive Workflow Intelligence</p>
            <button
              onClick={() => void refreshLearning()}
              className="rounded border border-amber-300/30 bg-amber-500/20 px-2 py-1 text-[10px] text-amber-200"
            >
              Refresh
            </button>
          </div>
          {recommendations.slice(0, 2).map((item) => (
            <div key={item.id} className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2">
              <p className="text-xs text-white/85">{item.title}</p>
              <p className="mt-1 text-[11px] text-white/65">{item.message}</p>
              {item.status === 'active' && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => void setRecommendationStatus(item.id, 'accepted')}
                    className="rounded border border-amber-300/30 px-2 py-1 text-[10px] text-amber-200"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => void setRecommendationStatus(item.id, 'dismissed')}
                    className="rounded border border-white/20 px-2 py-1 text-[10px] text-white/70"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
          {optimizations.slice(0, 2).map((item) => (
            <p key={item.id} className="mt-2 text-xs text-white/70">
              {item.workflowName}: {item.suggestion}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-white/40">No generated tasks yet.</p>
        ) : (
          tasks.slice(0, 20).map((task) => (
            <div key={task.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/85">{task.title}</p>
                <span className="text-xs uppercase text-amber-300">{task.status}</span>
              </div>
              <p className="mt-1 text-xs text-white/45">{task.intent}</p>
            </div>
          ))
        )}
      </div>
    </GlassPanel>
  )
}
