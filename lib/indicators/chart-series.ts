import type { Indicator, Observation } from "@/lib/domain/indicators"

export const CHART_INTERVALS = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1H",
  "5H",
  "1D",
  "1W",
  "1M",
] as const

export type ChartInterval = (typeof CHART_INTERVALS)[number]

export const TEMPORARY_MINIMUM_CHART_INTERVAL: ChartInterval = "1D"

/**
 * Keep a consistent visual density across intervals. 240 daily points are
 * roughly one trading year; the same count naturally expands weekly/monthly
 * views to longer horizons.
 */
export const DEFAULT_CHART_POINT_LIMIT = 240

export interface ChartPoint {
  time: number
  periodStart: string
  periodEnd: string
  value: number
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
  buyVolume: number | null
  sourcePointCount: number
}

const intervalOrder = Object.fromEntries(
  CHART_INTERVALS.map((interval, index) => [interval, index])
) as Record<ChartInterval, number>

const fixedIntervalMilliseconds: Partial<Record<ChartInterval, number>> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1H": 60 * 60_000,
  "5H": 5 * 60 * 60_000,
  "1D": 24 * 60 * 60_000,
}

function isChartInterval(value: unknown): value is ChartInterval {
  return (
    typeof value === "string" &&
    CHART_INTERVALS.includes(value as ChartInterval)
  )
}

function minimumIntervalForIndicator(indicator: Indicator): ChartInterval {
  const configured = indicator.metadata.minimum_interval
  if (isChartInterval(configured)) return configured

  const provider = String(
    indicator.metadata.provider ?? indicator.source
  ).toLowerCase()
  if (provider === "fred") return "1D"

  const frequency = indicator.frequency.trim().toLowerCase()
  if (frequency.includes("month")) return "1M"
  if (frequency.includes("week")) return "1W"
  if (frequency.includes("day") || frequency === "daily") return "1D"
  if (frequency.includes("5 hour")) return "5H"
  if (frequency.includes("hour")) return "1H"
  if (frequency.includes("30 min")) return "30m"
  if (frequency.includes("15 min")) return "15m"
  if (frequency.includes("5 min")) return "5m"
  if (frequency.includes("min")) return "1m"

  // Unknown sources default conservatively to daily until their provider
  // declares metadata.minimum_interval.
  return "1D"
}

export function getSupportedChartIntervals(
  indicator: Indicator
): Set<ChartInterval> {
  const providerMinimum = minimumIntervalForIndicator(indicator)
  const minimum =
    intervalOrder[providerMinimum] >
    intervalOrder[TEMPORARY_MINIMUM_CHART_INTERVAL]
      ? providerMinimum
      : TEMPORARY_MINIMUM_CHART_INTERVAL
  return new Set(
    CHART_INTERVALS.filter(
      (interval) => intervalOrder[interval] >= intervalOrder[minimum]
    )
  )
}

export function isTemporarilyDisabledChartInterval(
  interval: ChartInterval
): boolean {
  return (
    intervalOrder[interval] < intervalOrder[TEMPORARY_MINIMUM_CHART_INTERVAL]
  )
}

function startOfUtcWeek(timestamp: number): number {
  const date = new Date(timestamp)
  date.setUTCHours(0, 0, 0, 0)
  const daysSinceMonday = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - daysSinceMonday)
  return date.getTime()
}

function bucketStart(timestamp: number, interval: ChartInterval): number {
  if (interval === "1W") return startOfUtcWeek(timestamp)
  if (interval === "1M") {
    const date = new Date(timestamp)
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
  }

  const duration = fixedIntervalMilliseconds[interval]
  if (!duration) throw new Error(`Unsupported chart interval: ${interval}`)
  return Math.floor(timestamp / duration) * duration
}

function hasOhlc(
  observation: Observation
): observation is Observation & {
  open: number
  high: number
  low: number
  close: number
} {
  return (
    observation.open !== null &&
    observation.high !== null &&
    observation.low !== null &&
    observation.close !== null
  )
}

function completeSum(values: Array<number | null>): number | null {
  return values.every((value): value is number => value !== null)
    ? values.reduce((sum, value) => sum + value, 0)
    : null
}

export function aggregateObservations(
  observations: Observation[],
  interval: ChartInterval
): ChartPoint[] {
  const ordered = [...observations].sort(
    (left, right) =>
      Date.parse(left.observedAt) - Date.parse(right.observedAt)
  )
  const buckets = new Map<number, Observation[]>()

  for (const observation of ordered) {
    const timestamp = Date.parse(observation.observedAt)
    if (!Number.isFinite(timestamp)) continue
    const key = bucketStart(timestamp, interval)
    const values = buckets.get(key) ?? []
    values.push(observation)
    buckets.set(key, values)
  }

  return [...buckets.entries()].map(([time, values]) => {
    const first = values[0]
    const last = values.at(-1) ?? first
    const ohlcValues = values.every(hasOhlc) ? values : null

    return {
      time,
      periodStart: first.observedAt,
      periodEnd: last.observedAt,
      value: last.value,
      open: ohlcValues ? ohlcValues[0].open : null,
      high: ohlcValues
        ? Math.max(...ohlcValues.map((observation) => observation.high))
        : null,
      low: ohlcValues
        ? Math.min(...ohlcValues.map((observation) => observation.low))
        : null,
      close: ohlcValues
        ? (ohlcValues.at(-1) ?? ohlcValues[0]).close
        : null,
      volume: completeSum(values.map((observation) => observation.volume)),
      buyVolume: completeSum(
        values.map((observation) => observation.buyVolume)
      ),
      sourcePointCount: values.length,
    }
  })
}

export function takeLatestChartPoints<T>(
  points: T[],
  limit = DEFAULT_CHART_POINT_LIMIT
): T[] {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Chart point limit must be a positive integer.")
  }
  return points.length > limit ? points.slice(-limit) : points
}
