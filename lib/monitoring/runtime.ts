import { createClient } from "@supabase/supabase-js"

import {
  FredClient,
  FredTimeSeriesProvider,
  getFredApiKey,
} from "@/lib/data-providers/fred"
import { createMarketProviderRegistry } from "@/lib/data-providers/market"
import { syncFredIndicator } from "@/lib/ingestion/fred-sync"
import { syncMarketIndicator } from "@/lib/ingestion/market-sync"
import type { MonitoringDependencies } from "@/lib/monitoring/types"
import { createSupabaseMonitoringStore } from "@/lib/monitoring/supabase-store"
import { createSupabaseObservationIngestionStore } from "@/lib/repositories/observations"

interface MonitoringRuntimeOptions {
  environment?: Record<string, string | undefined>
  cwd?: string
  enableSync?: boolean
}

function requiredEnvironmentValue(
  environment: Record<string, string | undefined>,
  name: string
): string {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name} is not configured in .env.local.`)
  return value
}

function createErrorFormatter(
  environment: Record<string, string | undefined>
): (error: unknown) => string {
  const secrets = [
    environment.SUPABASE_SERVICE_ROLE_KEY,
    environment.FRED_API_KEY,
    environment.ALPHA_VANTAGE_API_KEY,
  ].filter((value): value is string => Boolean(value && value.length >= 4))

  return (error) => {
    let message =
      error instanceof Error ? error.message : "Unknown monitoring error"
    for (const secret of secrets) message = message.replaceAll(secret, "[REDACTED]")
    return message
  }
}

export function createMonitoringDependencies(
  options: MonitoringRuntimeOptions = {}
): MonitoringDependencies {
  const environment = options.environment ?? process.env
  const supabase = createClient(
    requiredEnvironmentValue(environment, "SUPABASE_URL"),
    requiredEnvironmentValue(environment, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const monitoringStore = createSupabaseMonitoringStore(supabase)
  const ingestionStore = createSupabaseObservationIngestionStore(supabase)
  const enableSync = options.enableSync !== false
  const marketProviders = enableSync
    ? createMarketProviderRegistry({
        environment,
        cwd: options.cwd,
      })
    : null
  let fredProvider: FredTimeSeriesProvider | null = null

  return {
    store: monitoringStore,
    formatError: createErrorFormatter(environment),
    async syncIndicator(indicator) {
      if (!enableSync || !marketProviders) {
        throw new Error("External sync is disabled for this monitoring runtime.")
      }

      if (indicator.source === "fred") {
        fredProvider ??= new FredTimeSeriesProvider(
          new FredClient({ apiKey: getFredApiKey(environment) })
        )
        return syncFredIndicator(
          { indicatorId: indicator.id },
          { store: ingestionStore, provider: fredProvider }
        )
      }

      return syncMarketIndicator(
        { indicatorId: indicator.id, interval: "1d" },
        { store: ingestionStore, providers: marketProviders }
      )
    },
  }
}
