import { describe, expect, it } from "vitest"

import {
  DEFAULT_MONITOR_INTERVAL_MS,
  getMonitorIntervalMs,
  MonitoringScheduler,
} from "@/lib/monitoring/scheduler"
import type { MonitoringCycleResult } from "@/lib/monitoring/types"

function result(): MonitoringCycleResult {
  return {
    startedAt: "2026-09-02T00:00:00.000Z",
    completedAt: "2026-09-02T00:00:01.000Z",
    dryRun: false,
    sync: {
      skipped: true,
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    },
    conditions: {
      total: 0,
      evaluated: 0,
      matched: 0,
      triggered: 0,
      skipped: 0,
      failed: 0,
      results: [],
      errors: [],
    },
    alertsCreated: 0,
  }
}

describe("monitoring scheduler", () => {
  it("uses an hourly default and validates overrides", () => {
    expect(getMonitorIntervalMs({})).toBe(DEFAULT_MONITOR_INTERVAL_MS)
    expect(getMonitorIntervalMs({ MONITOR_INTERVAL_MS: "120000" })).toBe(
      120_000
    )
    expect(() =>
      getMonitorIntervalMs({ MONITOR_INTERVAL_MS: "1000" })
    ).toThrow(/at least/)
  })

  it("skips an overlapping in-process trigger", async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const scheduler = new MonitoringScheduler(async () => {
      await pending
      return result()
    })

    const first = scheduler.trigger()
    expect(scheduler.isRunning).toBe(true)
    await expect(scheduler.trigger()).resolves.toBeNull()
    release()
    await expect(first).resolves.toEqual(result())
    expect(scheduler.isRunning).toBe(false)
  })
})
