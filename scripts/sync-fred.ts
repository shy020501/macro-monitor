import { loadEnvConfig } from "@next/env"
import { createClient } from "@supabase/supabase-js"

import {
  FRED_SERIES_MAPPINGS,
  FredClient,
  FredTimeSeriesProvider,
  getFredApiKey,
  getFredSeriesMapping,
} from "@/lib/data-providers/fred"
import { syncFredIndicator } from "@/lib/ingestion/fred-sync"
import type { ObservationSyncResult } from "@/lib/ingestion/types"
import { createSupabaseObservationIngestionStore } from "@/lib/repositories/observations"

interface CliOptions {
  indicator?: string
  startDate?: string
  endDate?: string
  help: boolean
}

function readOptionValue(args: string[], index: number, name: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`)
  }
  return value
}

function parseArguments(args: string[]): CliOptions {
  const options: CliOptions = { help: false }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]

    if (argument === "--help" || argument === "-h") {
      options.help = true
    } else if (argument === "--indicator") {
      options.indicator = readOptionValue(args, index, "--indicator")
      index += 1
    } else if (argument.startsWith("--indicator=")) {
      options.indicator = argument.slice("--indicator=".length)
    } else if (argument === "--start") {
      options.startDate = readOptionValue(args, index, "--start")
      index += 1
    } else if (argument.startsWith("--start=")) {
      options.startDate = argument.slice("--start=".length)
    } else if (argument === "--end") {
      options.endDate = readOptionValue(args, index, "--end")
      index += 1
    } else if (argument.startsWith("--end=")) {
      options.endDate = argument.slice("--end=".length)
    } else {
      throw new Error(`Unknown option: ${argument}`)
    }
  }

  return options
}

function printUsage(): void {
  console.log(`Usage:
  pnpm sync:fred
  pnpm sync:fred --indicator US10Y
  pnpm sync:fred --indicator US10Y --start 2020-01-01 --end 2026-08-25

Options:
  --indicator  Sync one verified FRED-enabled indicator (default: all)
  --start      Override incremental start date, in YYYY-MM-DD
  --end        Optional inclusive end date, in YYYY-MM-DD
  --help       Show this help`)
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured in .env.local.`)
  }
  return value
}

function printResult(result: ObservationSyncResult): void {
  console.log(`\n${result.indicator} (${result.providerSeriesId})`)
  console.log(`Range: ${result.from} to ${result.to ?? "latest"}`)
  console.log(`Fetched: ${result.fetched}`)
  console.log(`Valid: ${result.valid}`)
  console.log(`Inserted/Updated: ${result.upserted}`)
  console.log(`Skipped: ${result.skipped}`)
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd())
  const options = parseArguments(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  const symbols = options.indicator
    ? [options.indicator.trim().toUpperCase()]
    : FRED_SERIES_MAPPINGS.map((mapping) => mapping.indicatorSymbol)

  for (const symbol of symbols) {
    if (!getFredSeriesMapping(symbol)) {
      throw new Error(
        `${symbol} is not FRED-enabled. Verified symbols: ${FRED_SERIES_MAPPINGS.map((mapping) => mapping.indicatorSymbol).join(", ")}`
      )
    }
  }

  // Read server-only secrets only after argument validation. Neither value is
  // included in structured results or console output.
  const apiKey = getFredApiKey()
  const supabaseUrl = requiredEnvironmentValue("SUPABASE_URL")
  const serviceRoleKey = requiredEnvironmentValue(
    "SUPABASE_SERVICE_ROLE_KEY"
  )
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const store = createSupabaseObservationIngestionStore(supabase)
  const provider = new FredTimeSeriesProvider(new FredClient({ apiKey }))

  let failures = 0
  for (const symbol of symbols) {
    try {
      const indicator = await store.getIndicatorBySymbol(symbol)
      if (!indicator) throw new Error(`Indicator ${symbol} was not found.`)

      const result = await syncFredIndicator(
        {
          indicatorId: indicator.id,
          startDate: options.startDate,
          endDate: options.endDate,
        },
        { store, provider }
      )
      printResult(result)
    } catch (error) {
      failures += 1
      console.error(
        `\n${symbol}: ${error instanceof Error ? error.message : "Unknown sync error"}`
      )
    }
  }

  if (failures > 0) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "FRED sync failed.")
  process.exitCode = 1
})
