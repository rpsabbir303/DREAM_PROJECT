import os from 'node:os';
import si from 'systeminformation';
export async function getSystemSnapshot() {
    const [load, memory, processInfo] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.processes(),
    ]);
    const memoryTotalGb = Number((memory.total / 1024 ** 3).toFixed(1));
    const memoryUsedGb = Number(((memory.total - memory.available) / 1024 ** 3).toFixed(1));
    const memoryUsagePercent = Number((((memory.total - memory.available) / memory.total) * 100).toFixed(1));
    return {
        cpuUsagePercent: Number(load.currentLoad.toFixed(1)),
        memoryUsagePercent,
        memoryUsedGb,
        memoryTotalGb,
        uptimeSeconds: os.uptime(),
        activeProcesses: processInfo.all,
        timestamp: Date.now(),
    };
}
