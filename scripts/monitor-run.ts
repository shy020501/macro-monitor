import { loadEnvConfig } from "@next/env"

import {
  createMonitoringDependencies,
  runMonitoringCycle,
} from "@/lib/monitoring"
import {
  parseMonitoringArguments,
  printMonitoringResult,
} from "@/scripts/monitoring-cli"

function printUsage(): void {
  console.log(`Usage:
  pnpm monitor:run
  pnpm monitor:run -- --skip-sync
  pnpm monitor:run -- --dry-run

Options:
  --skip-sync  Evaluate current database observations without provider calls
  --dry-run    Sync/evaluate, but do not mutate alerts or runtime state
  --help       Show this help`)
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd())
  const options = parseMonitoringArguments(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  const dependencies = createMonitoringDependencies({
    cwd: process.cwd(),
    enableSync: !options.skipSync,
  })
  const result = await runMonitoringCycle(options, dependencies)
  printMonitoringResult(result)

  if (result.sync.failed > 0 || result.conditions.failed > 0) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Monitoring cycle failed."
  )
  process.exitCode = 1
})
