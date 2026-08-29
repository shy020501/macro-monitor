import type { SupabaseClient } from "@supabase/supabase-js"

import type { JsonObject } from "@/lib/domain/indicators"
import type {
  IngestionIndicator,
  ObservationIngestionStore,
  PointObservationWrite,
  StoredObservationRecord,
} from "@/lib/ingestion/types"

const READ_BATCH_SIZE = 200
const WRITE_BATCH_SIZE = 500

interface IndicatorRow {
  id: string
  symbol: string
  source: string
  metadata: JsonObject | null
}

interface ObservationRow {
  observed_at: string
  value: number | string
  open_value: number | string | null
  high_value: number | string | null
  low_value: number | string | null
  close_value: number | string | null
  volume: number | string | null
  buy_volume: number | string | null
  metadata: JsonObject | null
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function toIndicator(row: IndicatorRow): IngestionIndicator {
  return {
    id: row.id,
    symbol: row.symbol,
    source: row.source,
    metadata: row.metadata ?? {},
  }
}

function nullableNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value)
}

function toStoredObservation(row: ObservationRow): StoredObservationRecord {
  return {
    observedAt: new Date(row.observed_at).toISOString(),
    value: Number(row.value),
    open: nullableNumber(row.open_value),
    high: nullableNumber(row.high_value),
    low: nullableNumber(row.low_value),
    close: nullableNumber(row.close_value),
    volume: nullableNumber(row.volume),
    buyVolume: nullableNumber(row.buy_volume),
    metadata: row.metadata ?? {},
  }
}

/**
 * Supabase adapter used by server-side jobs and CLI commands. It receives an
 * already configured client so environment secrets never live in this module.
 */
export function createSupabaseObservationIngestionStore(
  supabase: SupabaseClient
): ObservationIngestionStore {
  async function findIndicator(
    column: "id" | "symbol",
    value: string
  ): Promise<IngestionIndicator | null> {
    const result = await supabase
      .from("indicators")
      .select("id,symbol,source,metadata")
      .eq(column, value)
      .maybeSingle()

    if (result.error) throw new Error(result.error.message)
    return result.data ? toIndicator(result.data as IndicatorRow) : null
  }

  return {
    getIndicatorById(indicatorId) {
      return findIndicator("id", indicatorId)
    },

    getIndicatorBySymbol(symbol) {
      return findIndicator("symbol", symbol.trim().toUpperCase())
    },

    async getLatestObservedAt(indicatorId) {
      const result = await supabase
        .from("observations")
        .select("observed_at")
        .eq("indicator_id", indicatorId)
        .order("observed_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (result.error) throw new Error(result.error.message)
      return result.data?.observed_at ?? null
    },

    async getExistingObservations(indicatorId, observedAts) {
      if (observedAts.length === 0) return []

      const records: StoredObservationRecord[] = []
      for (const batch of chunks([...new Set(observedAts)], READ_BATCH_SIZE)) {
        const result = await supabase
          .from("observations")
          .select(
            "observed_at,value,open_value,high_value,low_value,close_value,volume,buy_volume,metadata"
          )
          .eq("indicator_id", indicatorId)
          .in("observed_at", batch)

        if (result.error) throw new Error(result.error.message)
        records.push(
          ...(result.data as ObservationRow[]).map(toStoredObservation)
        )
      }

      return records
    },

    async upsertPointObservations(indicatorId, observations) {
      for (const batch of chunks(observations, WRITE_BATCH_SIZE)) {
        const rows = batch.map((observation: PointObservationWrite) => ({
          indicator_id: indicatorId,
          observed_at: observation.observedAt,
          value: observation.value,
          // FRED supplies point values, not OHLC. Nulling all four fields also
          // prevents a replaced mock candle from retaining stale OHLC data.
          open_value: null,
          high_value: null,
          low_value: null,
          close_value: null,
          volume: null,
          buy_volume: null,
          metadata: observation.metadata,
        }))

        const result = await supabase.from("observations").upsert(rows, {
          onConflict: "indicator_id,observed_at",
          ignoreDuplicates: false,
        })
        if (result.error) throw new Error(result.error.message)
      }
    },

    async updateIndicatorProvider(indicator, provider, providerSeriesId) {
      const result = await supabase
        .from("indicators")
        .update({
          source: provider,
          metadata: {
            ...indicator.metadata,
            provider,
            provider_series_id: providerSeriesId,
          },
        })
        .eq("id", indicator.id)

      if (result.error) throw new Error(result.error.message)
    },
  }
}
