import {
  resolveProviderForIndicator,
  type TimeSeriesProviderRegistry,
} from "@/lib/data-providers/registry"
import type { TimeSeriesInterval } from "@/lib/data-providers/types"
import {
  IndicatorNotFoundError,
  syncTimeSeriesIndicator,
} from "@/lib/ingestion/time-series-sync"
import type {
  ObservationIngestionStore,
  ObservationSyncResult,
} from "@/lib/ingestion/types"

export interface SyncMarketIndicatorInput {
  indicatorId: string
  startDate?: string
  endDate?: string
  interval?: TimeSeriesInterval
}

interface SyncMarketIndicatorDependencies {
  store: ObservationIngestionStore
  providers: TimeSeriesProviderRegistry
}

export interface MarketObservationSyncResult extends ObservationSyncResult {
  providerSymbol: string
}

export class IntradayMarketSyncDisabledError extends Error {
  constructor(interval: TimeSeriesInterval) {
    super(
      `Market interval ${interval} is temporarily disabled. Use the daily interval (1d).`
    )
    this.name = "IntradayMarketSyncDisabledError"
  }
}

export async function syncMarketIndicator(
  input: SyncMarketIndicatorInput,
  dependencies: SyncMarketIndicatorDependencies
): Promise<MarketObservationSyncResult> {
  const indicator = await dependencies.store.getIndicatorById(input.indicatorId)
  if (!indicator) throw new IndicatorNotFoundError(input.indicatorId)

  const interval = input.interval ?? "1d"
  if (interval !== "1d") {
    throw new IntradayMarketSyncDisabledError(interval)
  }
  const resolved = resolveProviderForIndicator(
    indicator,
    dependencies.providers,
    { expectedKind: "market", interval }
  )
  const result = await syncTimeSeriesIndicator(
    {
      indicator,
      provider: resolved.provider,
      providerInstrumentId: resolved.providerInstrumentId,
      startDate: input.startDate,
      endDate: input.endDate,
      interval,
      // A newly selected live provider may replace local seed observations,
      // but observations from FRED or another market provider remain blocked.
      allowSeedObservationTransition: true,
      allowProviderObservationTransition: true,
      provenance: { price_type: "close" },
    },
    dependencies.store
  )

  return { ...result, providerSymbol: resolved.providerInstrumentId }
}
