import {
  getFredSeriesMapping,
  type FredSeriesMapping,
} from "@/lib/data-providers/fred/mappings"
import type { TimeSeriesProvider } from "@/lib/data-providers/types"
import type {
  ObservationIngestionStore,
  ObservationSyncResult,
} from "@/lib/ingestion/types"
import {
  ActiveProviderMismatchError,
  IndicatorNotFoundError,
  syncTimeSeriesIndicator,
} from "@/lib/ingestion/time-series-sync"

export {
  ActiveProviderMismatchError,
  IndicatorNotFoundError,
  InvalidSyncRangeError,
} from "@/lib/ingestion/time-series-sync"

export class UnmappedIndicatorError extends Error {
  constructor(symbol: string) {
    super(`Indicator ${symbol} does not have a verified FRED series mapping.`)
    this.name = "UnmappedIndicatorError"
  }
}

export interface SyncFredIndicatorInput {
  indicatorId: string
  /** Explicit start overrides the incremental cursor, including seeded dates. */
  startDate?: string
  endDate?: string
}

interface SyncFredIndicatorDependencies {
  store: ObservationIngestionStore
  provider: TimeSeriesProvider
  resolveMapping?: (symbol: string) => FredSeriesMapping | undefined
}

export interface FredObservationSyncResult extends ObservationSyncResult {
  providerSeriesId: string
}

export async function syncFredIndicator(
  input: SyncFredIndicatorInput,
  dependencies: SyncFredIndicatorDependencies
): Promise<FredObservationSyncResult> {
  const indicator = await dependencies.store.getIndicatorById(input.indicatorId)
  if (!indicator) throw new IndicatorNotFoundError(input.indicatorId)

  const mapping = (dependencies.resolveMapping ?? getFredSeriesMapping)(
    indicator.symbol
  )
  if (!mapping) throw new UnmappedIndicatorError(indicator.symbol)

  if (
    dependencies.provider.id !== "fred" ||
    dependencies.provider.kind !== "economic"
  ) {
    throw new ActiveProviderMismatchError(
      `FRED sync requires the fred economic provider, not ${dependencies.provider.id}.`
    )
  }

  const result = await syncTimeSeriesIndicator(
    {
      indicator,
      provider: dependencies.provider,
      providerInstrumentId: mapping.seriesId,
      startDate: input.startDate,
      endDate: input.endDate,
      interval: "1d",
      allowSeedSourceTransition: true,
      allowProviderObservationTransition: true,
    },
    dependencies.store
  )

  return { ...result, providerSeriesId: mapping.seriesId }
}
