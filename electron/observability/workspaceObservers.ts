import type { MemoryRepository } from '../database/memoryRepository.js'
import { getSystemSnapshot } from '../system/systemMonitorService.js'
import type { EventBus } from './eventBus.js'

export class WorkspaceObservers {
  private timer: NodeJS.Timeout | null = null
  private lastWorkspaceTimestamp = ''
  private lastWorkflowRunId = ''
  private lastFailedTaskId = ''

  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly eventBus: EventBus,
  ) {}

  start() {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.tick()
    }, 4000)
    void this.tick()
  }

  stop() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  private async tick() {
    const workspace = this.memoryRepository.getLatestWorkspaceContext()
    if (workspace && workspace.timestamp !== this.lastWorkspaceTimestamp) {
      this.lastWorkspaceTimestamp = workspace.timestamp
      await this.eventBus.publish({
        type: 'workspace_changed',
        source: 'workspace',
        severity: 'info',
        title: 'Workspace Changed',
        message: `${workspace.app} - ${workspace.title}`,
        metadata: { app: workspace.app, process: workspace.processName },
        createdAt: new Date().toISOString(),
      })
    }

    const latestRun = this.memoryRepository.getWorkflowRuns(1)[0]
    if (latestRun && latestRun.id !== this.lastWorkflowRunId) {
      this.lastWorkflowRunId = latestRun.id
      await this.eventBus.publish({
        type: latestRun.status === 'failed' ? 'workflow_failed' : 'workflow_completed',
        source: 'workflow',
        severity: latestRun.status === 'failed' ? 'error' : 'info',
        title: `Workflow ${latestRun.status}`,
        message: latestRun.message,
        metadata: { workflowId: latestRun.workflowId, workflowName: latestRun.workflowName },
        createdAt: new Date().toISOString(),
      })
    }

    const failedTask = this.memoryRepository.getRecentTasks(20).find((task) => task.status === 'failed')
    if (failedTask && failedTask.id !== this.lastFailedTaskId) {
      this.lastFailedTaskId = failedTask.id
      await this.eventBus.publish({
        type: 'ai_task_failed',
        source: 'task',
        severity: 'error',
        title: 'AI Task Failed',
        message: `${failedTask.title} failed.`,
        metadata: { taskId: failedTask.id, intent: failedTask.intent },
        createdAt: new Date().toISOString(),
      })
    }

    const snapshot = await getSystemSnapshot()
    if (snapshot.cpuUsagePercent > 85 || snapshot.memoryUsagePercent > 90) {
      await this.eventBus.publish({
        type: 'system_resource_alert',
        source: 'system',
        severity: 'warning',
        title: 'High Resource Usage',
        message: `CPU ${snapshot.cpuUsagePercent}% | RAM ${snapshot.memoryUsagePercent}%`,
        metadata: { cpu: String(snapshot.cpuUsagePercent), ram: String(snapshot.memoryUsagePercent) },
        createdAt: new Date().toISOString(),
      })
    }
  }
}
