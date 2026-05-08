import type { DashboardSnapshot } from '@/types/system'

export const dashboardSnapshot: DashboardSnapshot = {
  aiHealth: 'optimal',
  automationStatus: 'online',
  voiceStatus: 'standby',
  uptime: '43h 12m',
  metrics: [
    { id: 'cpu', label: 'CPU Load', value: '34%', progress: 34, trend: 'steady' },
    { id: 'ram', label: 'RAM', value: '12.6 GB / 32 GB', progress: 39, trend: 'up' },
    { id: 'gpu', label: 'GPU Compute', value: '41%', progress: 41, trend: 'down' },
    {
      id: 'net',
      label: 'Neural Throughput',
      value: '1.2k tokens/s',
      progress: 74,
      trend: 'up',
    },
  ],
  activeTasks: [
    {
      id: 'task-1',
      title: 'Compile weekly engineering digest',
      status: 'running',
      eta: '02m 14s',
      command: 'python compile_digest.py --scope engineering',
    },
    {
      id: 'task-2',
      title: 'Automate backup verification',
      status: 'pending',
      eta: 'Queued',
      command: 'jarvis workflow run backup_integrity_v2',
    },
    {
      id: 'task-3',
      title: 'Refactor release changelog',
      status: 'completed',
      eta: 'Done',
      command: 'jarvis summarize commits --since "7 days"',
    },
  ],
  recentCommands: [
    {
      id: 'cmd-1',
      command: 'Open Figma board for sprint planning',
      time: '14:24',
      result: 'success',
    },
    {
      id: 'cmd-2',
      command: 'Generate quarterly budget variance summary',
      time: '14:17',
      result: 'warning',
    },
    {
      id: 'cmd-3',
      command: 'Deploy staging build and run smoke tests',
      time: '13:59',
      result: 'success',
    },
  ],
}
