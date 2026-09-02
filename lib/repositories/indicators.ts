import "server-only"

import type { Indicator, JsonObject, Observation } from "@/lib/domain/indicators"
import {
  assertObservationLimit,
  loadIndicatorObservations,
} from "@/lib/repositories/indicator-observations"
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

export interface GetIndicatorsOptions {
  /** Default number of newest observations loaded for each indicator. */
  defaultObservationLimit?: number
  /** Per-indicator overrides, primarily for exact Rule Engine requirements. */
  observationLimits?: Readonly<Record<string, number>>
}

export async function getIndicatorObservations(
  indicatorId: string,
  limit?: number
): Promise<Observation[]> {
  return loadIndicatorObservations(
    createSupabaseServerClient(),
    indicatorId,
    limit
  )
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
      return [
        row.id,
        await loadIndicatorObservations(supabase, row.id, limit),
      ] as const
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
