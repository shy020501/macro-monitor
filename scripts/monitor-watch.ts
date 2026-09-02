import { loadEnvConfig } from "@next/env"

import {
  createMonitoringDependencies,
  runMonitoringCycle,
} from "@/lib/monitoring"
import {
  getMonitorIntervalMs,
  MonitoringScheduler,
} from "@/lib/monitoring/scheduler"
import {
  parseMonitoringArguments,
  printMonitoringResult,
} from "@/scripts/monitoring-cli"

function printUsage(): void {
  console.log(`Usage:
  pnpm monitor:watch
  pnpm monitor:watch -- --skip-sync

Environment:
  MONITOR_INTERVAL_MS  Polling interval in milliseconds (default: 3600000)`)
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd())
  const options = parseMonitoringArguments(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  const intervalMs = getMonitorIntervalMs()
  const dependencies = createMonitoringDependencies({
    cwd: process.cwd(),
    enableSync: !options.skipSync,
  })
  const scheduler = new MonitoringScheduler(() =>
    runMonitoringCycle(options, dependencies)
  )

  const execute = async () => {
    try {
      const result = await scheduler.trigger()
      if (!result) {
        console.warn("Monitoring cycle skipped because the previous run is active.")
        return
      }
      printMonitoringResult(result)
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Monitoring cycle failed."
      )
    }
  }

  console.log(`Local monitor started (interval: ${intervalMs}ms).`)
  await execute()
  const timer = setInterval(() => void execute(), intervalMs)

  const stop = () => {
    clearInterval(timer)
    console.log("Local monitor stopped.")
  }
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Scheduler failed.")
  process.exitCode = 1
})
