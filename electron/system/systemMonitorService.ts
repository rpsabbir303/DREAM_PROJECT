import os from 'node:os'
import si from 'systeminformation'
import type { SystemSnapshot } from '../../shared/interfaces/ipc.js'

export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  const [load, memory, processInfo, fsSize, graphics] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.processes(),
    si.fsSize(),
    si.graphics(),
  ])

  const memoryTotalGb = Number((memory.total / 1024 ** 3).toFixed(1))
  const memoryUsedGb = Number(((memory.total - memory.available) / 1024 ** 3).toFixed(1))
  const memoryUsagePercent = Number((((memory.total - memory.available) / memory.total) * 100).toFixed(1))
  const primaryDisk = fsSize[0]
  const diskTotalGb = primaryDisk ? Number((primaryDisk.size / 1024 ** 3).toFixed(1)) : 0
  const diskUsedGb = primaryDisk ? Number((primaryDisk.used / 1024 ** 3).toFixed(1)) : 0
  const diskUsagePercent = primaryDisk ? Number(primaryDisk.use.toFixed(1)) : 0
  const gpuUsagePercent = graphics.controllers[0]?.utilizationGpu ?? null

  return {
    cpuUsagePercent: Number(load.currentLoad.toFixed(1)),
    memoryUsagePercent,
    memoryUsedGb,
    memoryTotalGb,
    diskUsagePercent,
    diskUsedGb,
    diskTotalGb,
    gpuUsagePercent: gpuUsagePercent === null ? null : Number(gpuUsagePercent.toFixed(1)),
    uptimeSeconds: os.uptime(),
    activeProcesses: processInfo.all,
    osPlatform: os.platform(),
    osRelease: os.release(),
    osArch: os.arch(),
    hostname: os.hostname(),
    timestamp: Date.now(),
  }
}
