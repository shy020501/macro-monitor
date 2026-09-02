import type { JsonObject } from "@/lib/domain/indicators"

export interface IngestionIndicator {
  id: string
  symbol: string
  source: string
  metadata: JsonObject
}

export interface StoredObservationRecord {
  observedAt: string
  value: number
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
  buyVolume: number | null
  metadata: JsonObject
}

export interface ObservationWrite {
  observedAt: string
  value: number
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
  buyVolume: number | null
  metadata: JsonObject
}

export interface ObservationIngestionStore {
  getIndicatorById(indicatorId: string): Promise<IngestionIndicator | null>
  getIndicatorBySymbol(symbol: string): Promise<IngestionIndicator | null>
  getLatestObservedAt(indicatorId: string): Promise<string | null>
  getExistingObservations(
    indicatorId: string,
    observedAts: string[]
  ): Promise<StoredObservationRecord[]>
  upsertObservations(
    indicatorId: string,
    observations: ObservationWrite[]
  ): Promise<void>
  deleteObservationsExceptProvider(
    indicatorId: string,
    provider: string
  ): Promise<void>
  updateIndicatorProvider(
    indicator: IngestionIndicator,
    provider: string,
    providerMetadata: JsonObject
  ): Promise<void>
}

export interface ObservationSyncResult {
  indicator: string
  indicatorId: string
  provider: string
  providerInstrumentId: string
  fetched: number
  valid: number
  upserted: number
  skipped: number
  from: string
  to: string | null
}
