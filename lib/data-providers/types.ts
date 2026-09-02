import type { JsonObject } from "@/lib/domain/indicators"

export type TimeSeriesProviderKind = "economic" | "market"

export type TimeSeriesProviderCapability =
  | "daily"
  | "intraday"
  | "fx"
  | "index"
  | "commodity"
  | "ohlc"

export type TimeSeriesInterval = "1d" | "1h" | "15m" | "5m"

export interface NormalizedObservation {
  /** ISO 8601 timestamp normalized to UTC. */
  observedAt: string
  /** Canonical rule-engine value. Equals close when OHLC is present. */
  value: number
  open?: number
  high?: number
  low?: number
  close?: number
  volume?: number
  buyVolume?: number
  metadata: JsonObject
}

export interface FetchObservationsInput {
  /** Provider-native series, ticker, or instrument identifier. */
  providerInstrumentId: string
  startDate: string
  endDate?: string
  /** Daily is the current MVP default; adapters may add intraday support later. */
  interval?: TimeSeriesInterval
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
  readonly kind: TimeSeriesProviderKind
  readonly instrumentMetadataKey: string
  readonly capabilities: readonly TimeSeriesProviderCapability[]
  supportsInstrument?(providerInstrumentId: string): boolean
  fetchObservations(input: FetchObservationsInput): Promise<ObservationBatch>
}
