export type Health = 'optimal' | 'stable' | 'warning' | 'critical'
export type TaskStatus = 'running' | 'completed' | 'pending' | 'failed'

export interface SystemMetric {
  id: string
  label: string
  value: string
  progress: number
  trend: 'up' | 'down' | 'steady'
}

export interface TaskItem {
  id: string
  title: string
  status: TaskStatus
  eta: string
  command: string
}

export interface CommandLog {
  id: string
  command: string
  time: string
  result: 'success' | 'warning' | 'error'
}

export interface DashboardSnapshot {
  aiHealth: Health
  automationStatus: 'online' | 'syncing' | 'idle'
  voiceStatus: 'listening' | 'standby' | 'muted'
  uptime: string
  metrics: SystemMetric[]
  activeTasks: TaskItem[]
  recentCommands: CommandLog[]
}
