import type { MonitoringCycleResult } from "@/lib/monitoring/types"

export const DEFAULT_MONITOR_INTERVAL_MS = 60 * 60 * 1_000
export const MINIMUM_MONITOR_INTERVAL_MS = 60 * 1_000

export function getMonitorIntervalMs(
  environment: Record<string, string | undefined> = process.env
): number {
  const configured = environment.MONITOR_INTERVAL_MS?.trim()
  if (!configured) return DEFAULT_MONITOR_INTERVAL_MS

  const interval = Number(configured)
  if (
    !Number.isSafeInteger(interval) ||
    interval < MINIMUM_MONITOR_INTERVAL_MS
  ) {
    throw new Error(
      `MONITOR_INTERVAL_MS must be an integer of at least ${MINIMUM_MONITOR_INTERVAL_MS}.`
    )
  }
  return interval
}

export class MonitoringScheduler {
  private running = false

  constructor(
    private readonly runCycle: () => Promise<MonitoringCycleResult>
  ) {}

  get isRunning(): boolean {
    return this.running
  }

  async trigger(): Promise<MonitoringCycleResult | null> {
    if (this.running) return null
    this.running = true
    try {
      return await this.runCycle()
    } finally {
      this.running = false
    }
  }
}
