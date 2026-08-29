export type JsonObject = Record<string, unknown>

export interface Observation {
  id: string
  indicatorId: string
  observedAt: string
  /** Canonical point value used by the rule engine. It is the candle close when OHLC exists. */
  value: number
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
  buyVolume: number | null
  metadata: JsonObject
}

export interface Indicator {
  id: string
  symbol: string
  name: string
  category: string
  source: string
  unit: string
  frequency: string
  metadata: JsonObject
  observations: Observation[]
}

export interface IndicatorSummary extends Indicator {
  latest: Observation | null
  previous: Observation | null
  change: number | null
  changePercent: number | null
  direction: "up" | "down" | "flat" | "unknown"
}

export type ObservationsByIndicator = Record<string, Observation[]>

export function summarizeIndicator(indicator: Indicator): IndicatorSummary {
  const observations = [...indicator.observations].sort(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)
  )
  const latest = observations.at(-1) ?? null
  const previous = observations.at(-2) ?? null
  const change = latest && previous ? latest.value - previous.value : null
  const changePercent =
    change !== null && previous && previous.value !== 0
      ? (change / Math.abs(previous.value)) * 100
      : null

  return {
    ...indicator,
    observations,
    latest,
    previous,
    change,
    changePercent,
    direction:
      change === null
        ? "unknown"
        : change > 0
          ? "up"
          : change < 0
            ? "down"
            : "flat",
  }
}

export function groupObservationsByIndicator(
  indicators: Indicator[]
): ObservationsByIndicator {
  return Object.fromEntries(
    indicators.map((indicator) => [indicator.id, indicator.observations])
  )
}
