import {
  getFredSeriesMapping,
  type FredSeriesMapping,
} from "@/lib/data-providers/fred/mappings"
import type { TimeSeriesProvider } from "@/lib/data-providers/types"
import type {
  IngestionIndicator,
  ObservationIngestionStore,
  ObservationSyncResult,
  StoredObservationRecord,
} from "@/lib/ingestion/types"

export class IndicatorNotFoundError extends Error {
  constructor(indicatorId: string) {
    super(`Indicator ${indicatorId} was not found.`)
    this.name = "IndicatorNotFoundError"
  }
}

export class UnmappedIndicatorError extends Error {
  constructor(symbol: string) {
    super(`Indicator ${symbol} does not have a verified FRED series mapping.`)
    this.name = "UnmappedIndicatorError"
  }
}

export class InvalidSyncRangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidSyncRangeError"
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

function parseDateOnly(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidSyncRangeError(`${field} must use YYYY-MM-DD format.`)
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new InvalidSyncRangeError(`${field} is not a valid calendar date.`)
  }
  return parsed
}

function toUtcDateOnly(timestamp: string): string {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    throw new InvalidSyncRangeError(
      `Latest observation timestamp is invalid: ${timestamp}`
    )
  }
  return parsed.toISOString().slice(0, 10)
}

function nextUtcDate(dateOnly: string): string {
  const date = parseDateOnly(dateOnly, "latest observation date")
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

async function resolveStartDate(
  input: SyncFredIndicatorInput,
  store: ObservationIngestionStore
): Promise<string> {
  if (input.startDate) {
    parseDateOnly(input.startDate, "startDate")
    return input.startDate
  }

  const latestObservedAt = await store.getLatestObservedAt(input.indicatorId)
  if (!latestObservedAt) {
    throw new InvalidSyncRangeError(
      "startDate is required for the first sync when no observations exist."
    )
  }

  return nextUtcDate(toUtcDateOnly(latestObservedAt))
}

function existingMatchesFredPoint(
  existing: StoredObservationRecord | undefined,
  incoming: { value: number; metadata: Record<string, unknown> },
  seriesId: string
): boolean {
  return Boolean(
    existing &&
      existing.value === incoming.value &&
      existing.open === null &&
      existing.high === null &&
      existing.low === null &&
      existing.close === null &&
      existing.volume === null &&
      existing.buyVolume === null &&
      existing.metadata.provider === "fred" &&
      existing.metadata.provider_series_id === seriesId
  )
}

function providerMetadataIsCurrent(
  indicator: IngestionIndicator,
  seriesId: string
): boolean {
  return (
    indicator.source === "fred" &&
    indicator.metadata.provider === "fred" &&
    indicator.metadata.provider_series_id === seriesId
  )
}

export async function syncFredIndicator(
  input: SyncFredIndicatorInput,
  dependencies: SyncFredIndicatorDependencies
): Promise<ObservationSyncResult> {
  if (input.endDate) parseDateOnly(input.endDate, "endDate")

  const indicator = await dependencies.store.getIndicatorById(input.indicatorId)
  if (!indicator) throw new IndicatorNotFoundError(input.indicatorId)

  const mapping = (dependencies.resolveMapping ?? getFredSeriesMapping)(
    indicator.symbol
  )
  if (!mapping) throw new UnmappedIndicatorError(indicator.symbol)

  const from = await resolveStartDate(input, dependencies.store)
  if (
    input.endDate &&
    parseDateOnly(from, "startDate") > parseDateOnly(input.endDate, "endDate")
  ) {
    return {
      indicator: indicator.symbol,
      indicatorId: indicator.id,
      provider: dependencies.provider.id,
      providerSeriesId: mapping.seriesId,
      fetched: 0,
      valid: 0,
      upserted: 0,
      skipped: 0,
      from,
      to: input.endDate,
    }
  }

  const batch = await dependencies.provider.fetchObservations({
    providerSeriesId: mapping.seriesId,
    startDate: from,
    endDate: input.endDate,
  })
  const existingRows = await dependencies.store.getExistingObservations(
    indicator.id,
    batch.observations.map((observation) => observation.observedAt)
  )
  const existingByTimestamp = new Map(
    existingRows.map((observation) => [observation.observedAt, observation])
  )
  const changed = batch.observations.filter(
    (observation) =>
      !existingMatchesFredPoint(
        existingByTimestamp.get(observation.observedAt),
        observation,
        mapping.seriesId
      )
  )

  await dependencies.store.upsertPointObservations(indicator.id, changed)

  if (
    batch.observations.length > 0 &&
    !providerMetadataIsCurrent(indicator, mapping.seriesId)
  ) {
    await dependencies.store.updateIndicatorProvider(
      indicator,
      dependencies.provider.id,
      mapping.seriesId
    )
  }

  return {
    indicator: indicator.symbol,
    indicatorId: indicator.id,
    provider: dependencies.provider.id,
    providerSeriesId: mapping.seriesId,
    fetched: batch.fetchedCount,
    valid: batch.observations.length,
    upserted: changed.length,
    skipped:
      batch.skippedCount + (batch.observations.length - changed.length),
    from,
    to: input.endDate ?? null,
  }
}
