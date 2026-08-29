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

const OBSERVATION_PAGE_SIZE = 1_000

function nullableNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value)
}

export async function getIndicators(): Promise<Indicator[]> {
  const supabase = createSupabaseServerClient()
  const indicatorPromise = supabase
    .from("indicators")
    .select("id,symbol,name,category,source,unit,frequency,metadata")
    .order("symbol")

  const observationPromise = (async (): Promise<ObservationRow[]> => {
    const rows: ObservationRow[] = []

    for (let from = 0; ; from += OBSERVATION_PAGE_SIZE) {
      const result = await supabase
        .from("observations")
        .select(
          "id,indicator_id,observed_at,value,open_value,high_value,low_value,close_value,volume,buy_volume,metadata"
        )
        .order("observed_at", { ascending: true })
        .order("indicator_id", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + OBSERVATION_PAGE_SIZE - 1)

      if (result.error) throw new Error(result.error.message)
      const page = result.data as ObservationRow[]
      rows.push(...page)
      if (page.length < OBSERVATION_PAGE_SIZE) return rows
    }
  })()

  const [indicatorResult, observationRows] = await Promise.all([
    indicatorPromise,
    observationPromise,
  ])

  if (indicatorResult.error) throw new Error(indicatorResult.error.message)

  const observations = observationRows.map(
    (row): Observation => ({
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
    })
  )
  const byIndicator = new Map<string, Observation[]>()
  for (const observation of observations) {
    const values = byIndicator.get(observation.indicatorId) ?? []
    values.push(observation)
    byIndicator.set(observation.indicatorId, values)
  }

  return (indicatorResult.data as IndicatorRow[]).map((row) => ({
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
