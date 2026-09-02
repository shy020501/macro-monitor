import type { MonitoringCycleOptions, MonitoringCycleResult } from "@/lib/monitoring"

export interface MonitoringCliOptions extends MonitoringCycleOptions {
  help: boolean
}

export function parseMonitoringArguments(args: string[]): MonitoringCliOptions {
  const options: MonitoringCliOptions = { help: false }
  for (const argument of args) {
    if (argument === "--") continue
    if (argument === "--help" || argument === "-h") options.help = true
    else if (argument === "--skip-sync") options.skipSync = true
    else if (argument === "--dry-run") options.dryRun = true
    else throw new Error(`Unknown option: ${argument}`)
  }
  return options
}

export function printMonitoringResult(result: MonitoringCycleResult): void {
  console.log(`Monitoring cycle started: ${result.startedAt}`)
  console.log("\nSync:")
  if (result.sync.skipped) {
    console.log("SKIPPED (--skip-sync)")
  } else if (result.sync.results.length === 0) {
    console.log("No external indicators configured.")
  } else {
    for (const item of result.sync.results) {
      console.log(
        `${item.indicator.padEnd(18)} ${item.status === "succeeded" ? "OK" : "FAILED"}${item.error ? ` - ${item.error}` : ""}`
      )
    }
  }

  console.log("\nConditions:")
  if (result.conditions.results.length === 0) {
    console.log("No enabled conditions.")
  } else {
    for (const item of result.conditions.results) {
      console.log(
        `${item.conditionName.padEnd(32)} ${item.status.toUpperCase()}${item.error ? ` - ${item.error}` : ""}`
      )
    }
  }

  console.log(`\nAlerts created: ${result.alertsCreated}`)
  if (result.dryRun) console.log("Dry run: alert/runtime state was not mutated.")
  console.log(`Monitoring cycle completed: ${result.completedAt}`)
}
