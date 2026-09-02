import "server-only"

import type { Indicator, JsonObject, Observation } from "@/lib/domain/indicators"
import { createSupabaseServerClient } from "@/lib/supabase/server"

interface IndicatorRow {
  id: string
  symbol: string
  name: string
  category: string
  source: string
  unit: string
  frequency: string
  metadata: JsonObject
}

interface ObservationRow {
  id: string
  indicator_id: string
  observed_at: string
  value: number | string
  open_value: number | string | null
  high_value: number | string | null
  low_value: number | string | null
  close_value: number | string | null
  volume: number | string | null
  buy_volume: number | string | null
  metadata: JsonObject
}

export interface GetIndicatorsOptions {
  /** Default number of newest observations loaded for each indicator. */
  defaultObservationLimit?: number
  /** Per-indicator overrides, primarily for exact Rule Engine requirements. */
  observationLimits?: Readonly<Record<string, number>>
}

const OBSERVATION_PAGE_SIZE = 1_000
const OBSERVATION_COLUMNS =
  "id,indicator_id,observed_at,value,open_value,high_value,low_value,close_value,volume,buy_volume,metadata"

function nullableNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value)
}

function mapObservation(row: ObservationRow): Observation {
  return {
    id: row.id,
    indicatorId: row.indicator_id,
    observedAt: row.observed_at,
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

function assertObservationLimit(limit: number | undefined): void {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
    throw new Error("Observation limit must be a non-negative integer.")
  }
}

export async function getIndicatorObservations(
  indicatorId: string,
  limit?: number
): Promise<Observation[]> {
  assertObservationLimit(limit)
  if (limit === 0) return []

  const supabase = createSupabaseServerClient()
  const rows: ObservationRow[] = []
  const targetCount = limit ?? Number.POSITIVE_INFINITY

  for (let from = 0; from < targetCount; from += OBSERVATION_PAGE_SIZE) {
    const pageSize = Math.min(OBSERVATION_PAGE_SIZE, targetCount - from)
    const result = await supabase
      .from("observations")
      .select(OBSERVATION_COLUMNS)
      .eq("indicator_id", indicatorId)
      .order("observed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1)

    if (result.error) throw new Error(result.error.message)
    const page = result.data as ObservationRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return rows.map(mapObservation).reverse()
}

export async function getIndicators(
  options: GetIndicatorsOptions = {}
): Promise<Indicator[]> {
  assertObservationLimit(options.defaultObservationLimit)
  Object.values(options.observationLimits ?? {}).forEach(assertObservationLimit)

  const supabase = createSupabaseServerClient()
  const indicatorResult = await supabase
    .from("indicators")
    .select("id,symbol,name,category,source,unit,frequency,metadata")
    .order("symbol")

  if (indicatorResult.error) throw new Error(indicatorResult.error.message)
  const indicatorRows = indicatorResult.data as IndicatorRow[]

  const observationEntries = await Promise.all(
    indicatorRows.map(async (row) => {
      const configuredLimits = [
        options.defaultObservationLimit,
        options.observationLimits?.[row.id],
      ].filter((value): value is number => value !== undefined)
      const limit =
        configuredLimits.length > 0 ? Math.max(...configuredLimits) : undefined
      return [row.id, await getIndicatorObservations(row.id, limit)] as const
    })
  )
  const byIndicator = new Map(observationEntries)

  return indicatorRows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    category: row.category,
    source: row.source,
    unit: row.unit,
    frequency: row.frequency,
    metadata: row.metadata ?? {},
    observations: byIndicator.get(row.id) ?? [],
  }))
}
