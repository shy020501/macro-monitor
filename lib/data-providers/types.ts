import type { JsonObject } from "@/lib/domain/indicators"

export interface NormalizedObservation {
  /** ISO 8601 timestamp normalized to UTC. */
  observedAt: string
  value: number
  metadata: JsonObject
}

export interface FetchObservationsInput {
  providerSeriesId: string
  startDate: string
  endDate?: string
}

export interface ObservationBatch {
  observations: NormalizedObservation[]
  /** Number of provider rows received before validation and de-duplication. */
  fetchedCount: number
  /** Number of provider rows discarded as missing, invalid, or duplicated. */
  skippedCount: number
}

export interface TimeSeriesProvider {
  readonly id: string
  fetchObservations(input: FetchObservationsInput): Promise<ObservationBatch>
}
