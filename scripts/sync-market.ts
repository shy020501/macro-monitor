import { loadEnvConfig } from "@next/env"
import { createClient } from "@supabase/supabase-js"

import { createMarketProviderRegistry } from "@/lib/data-providers/market"
import { syncMarketIndicator } from "@/lib/ingestion/market-sync"
import type { MarketObservationSyncResult } from "@/lib/ingestion/market-sync"
import { createSupabaseObservationIngestionStore } from "@/lib/repositories/observations"

const DEFAULT_MARKET_INDICATORS = [
  "DXY",
  "US10Y",
  "SP500",
  "NASDAQ",
  "VIX",
  "KOSPI",
  "KOSDAQ",
  "WTI",
  "COPPER",
  "USDKRW",
  "USDJPY",
  "GOLD",
] as const

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
  pnpm sync:market
  pnpm sync:market --indicator DXY
  pnpm sync:market --indicator GOLD --start 2020-01-01 --end 2026-09-02

Options:
  --indicator  Sync one configured market indicator (default: all twelve)
  --start      Override incremental start date, in YYYY-MM-DD
  --end        Optional inclusive end date, in YYYY-MM-DD
  --help       Show this help

Only daily (1d) sync is currently enabled. Yahoo-backed indicators need Python
and yfinance; GOLD additionally needs ALPHA_VANTAGE_API_KEY.`)
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured in .env.local.`)
  return value
}

function printResult(result: MarketObservationSyncResult): void {
  console.log(`\n${result.indicator} (${result.providerSymbol})`)
  console.log(`Provider: ${result.provider}`)
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

  const providers = createMarketProviderRegistry()
  const supabase = createClient(
    requiredEnvironmentValue("SUPABASE_URL"),
    requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const store = createSupabaseObservationIngestionStore(supabase)
  const symbols = options.indicator
    ? [options.indicator.trim().toUpperCase()]
    : [...DEFAULT_MARKET_INDICATORS]

  let failures = 0
  for (const symbol of symbols) {
    try {
      const indicator = await store.getIndicatorBySymbol(symbol)
      if (!indicator) throw new Error(`Indicator ${symbol} was not found.`)
      const result = await syncMarketIndicator(
        {
          indicatorId: indicator.id,
          startDate: options.startDate,
          endDate: options.endDate,
          interval: "1d",
        },
        { store, providers }
      )
      printResult(result)
    } catch (error) {
      failures += 1
      console.error(
        `\n${symbol}: ${error instanceof Error ? error.message : "Unknown market sync error"}`
      )
    }
  }

  if (failures > 0) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Market sync failed.")
  process.exitCode = 1
})
