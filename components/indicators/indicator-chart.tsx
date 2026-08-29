"use client"

import { useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Button } from "@/components/ui/button"
import type { Indicator } from "@/lib/domain/indicators"
import { formatNumber } from "@/lib/formatters"
import {
  aggregateObservations,
  CHART_INTERVALS,
  DEFAULT_CHART_POINT_LIMIT,
  getSupportedChartIntervals,
  takeLatestChartPoints,
  type ChartInterval,
  type ChartPoint,
} from "@/lib/indicators/chart-series"
import {
  calculateMovingAverageSeries,
  MOVING_AVERAGE_WINDOWS,
  type MovingAverageWindow,
} from "@/lib/indicators/series"

type MovingAverageKey = `ma${MovingAverageWindow}`
type ChartDatum = ChartPoint & Record<MovingAverageKey, number | null>

const movingAverageLines = [
  { window: 5, key: "ma5", label: "MA5", color: "#2563eb" },
  { window: 20, key: "ma20", label: "MA20", color: "#d97706" },
  { window: 60, key: "ma60", label: "MA60", color: "#7c3aed" },
  { window: 120, key: "ma120", label: "MA120", color: "#64748b" },
] as const satisfies ReadonlyArray<{
  window: MovingAverageWindow
  key: MovingAverageKey
  label: string
  color: string
}>

const intradayIntervals = new Set<ChartInterval>([
  "1m",
  "5m",
  "15m",
  "30m",
  "1H",
  "5H",
])

function createChartData(
  indicator: Indicator,
  interval: ChartInterval
): { data: ChartDatum[]; total: number } {
  const points = aggregateObservations(indicator.observations, interval)
  const values = points.map((point) => point.value)
  const averages = Object.fromEntries(
    MOVING_AVERAGE_WINDOWS.map((window) => [
      window,
      calculateMovingAverageSeries(values, window),
    ])
  ) as Record<MovingAverageWindow, Array<number | null>>

  const completeData = points.map((point, index) => ({
    ...point,
    ma5: averages[5][index],
    ma20: averages[20][index],
    ma60: averages[60][index],
    ma120: averages[120][index],
  }))

  return {
    data: takeLatestChartPoints(completeData),
    total: completeData.length,
  }
}

function formatTooltipPeriod(
  point: ChartDatum,
  interval: ChartInterval
): string {
  const format = (value: string, includeTime: boolean) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...(includeTime
        ? { hour: "2-digit", minute: "2-digit", hour12: false }
        : {}),
      timeZone: "UTC",
    }).format(new Date(value))

  const includeTime = intradayIntervals.has(interval)
  const start = format(point.periodStart, includeTime)
  const end = format(point.periodEnd, includeTime)
  return start === end ? start : `${start} – ${end}`
}

function ObservationTooltip({
  active,
  payload,
  visibleAverages,
  interval,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: ChartDatum }>
  visibleAverages: MovingAverageWindow[]
  interval: ChartInterval
}) {
  const point = payload?.find((entry) => entry.payload)?.payload
  if (!active || !point) return null

  const hasOhlc =
    point.open !== null &&
    point.high !== null &&
    point.low !== null &&
    point.close !== null

  return (
    <div className="min-w-52 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
      <p className="mb-2 font-medium">
        {formatTooltipPeriod(point, interval)}
      </p>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-1.5 font-mono">
        {hasOhlc ? (
          <>
            <dt className="font-sans text-muted-foreground">Open</dt>
            <dd className="text-right">{formatNumber(point.open, 4)}</dd>
            <dt className="font-sans text-muted-foreground">High</dt>
            <dd className="text-right">{formatNumber(point.high, 4)}</dd>
            <dt className="font-sans text-muted-foreground">Low</dt>
            <dd className="text-right">{formatNumber(point.low, 4)}</dd>
            <dt className="font-sans text-muted-foreground">Close</dt>
            <dd className="text-right">{formatNumber(point.close, 4)}</dd>
          </>
        ) : (
          <>
            <dt className="font-sans text-muted-foreground">Value</dt>
            <dd className="text-right">{formatNumber(point.value, 4)}</dd>
          </>
        )}
        {point.volume !== null && (
          <>
            <dt className="font-sans text-muted-foreground">Volume</dt>
            <dd className="text-right">{formatNumber(point.volume, 0)}</dd>
          </>
        )}
        {point.buyVolume !== null && (
          <>
            <dt className="font-sans text-muted-foreground">Buy volume</dt>
            <dd className="text-right">{formatNumber(point.buyVolume, 0)}</dd>
          </>
        )}
        {movingAverageLines
          .filter(({ window }) => visibleAverages.includes(window))
          .map(({ key, label }) => (
            <div className="contents" key={key}>
              <dt className="font-sans text-muted-foreground">{label}</dt>
              <dd className="text-right">{formatNumber(point[key], 4)}</dd>
            </div>
          ))}
      </dl>
    </div>
  )
}

function formatAxisTick(
  value: number,
  interval: ChartInterval,
  span: number
): string {
  const date = new Date(value)
  if (intradayIntervals.has(interval)) {
    return new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(date)
  }
  if (interval === "1M" || span > 370 * 24 * 60 * 60 * 1_000) {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: interval === "1M" ? "short" : undefined,
      timeZone: "UTC",
    }).format(date)
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date)
}

export function IndicatorChart({ indicator }: { indicator: Indicator }) {
  const [interval, setInterval] = useState<ChartInterval>("1D")
  const [visibleAverages, setVisibleAverages] = useState<
    MovingAverageWindow[]
  >([])
  const supportedIntervals = useMemo(
    () => getSupportedChartIntervals(indicator),
    [indicator]
  )
  const chartSeries = useMemo(
    () => createChartData(indicator, interval),
    [indicator, interval]
  )
  const { data, total } = chartSeries
  const span = data.length > 1 ? data.at(-1)!.time - data[0].time : 0

  function toggleMovingAverage(window: MovingAverageWindow): void {
    setVisibleAverages((current) =>
      current.includes(window)
        ? current.filter((value) => value !== window)
        : [...current, window]
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          {CHART_INTERVALS.map((option) => {
            const supported = supportedIntervals.has(option)
            return (
              <Button
                key={option}
                type="button"
                size="xs"
                variant={interval === option ? "secondary" : "ghost"}
                disabled={!supported}
                aria-pressed={interval === option}
                title={
                  supported
                    ? `Show ${option} observations`
                    : `${option} is below this series' minimum interval`
                }
                onClick={() => setInterval(option)}
              >
                {option}
              </Button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[11px] font-medium text-muted-foreground">
            Moving averages
          </span>
          {movingAverageLines.map(({ window, label, color }) => {
            const visible = visibleAverages.includes(window)
            return (
              <Button
                key={window}
                type="button"
                size="xs"
                variant={visible ? "secondary" : "ghost"}
                aria-pressed={visible}
                onClick={() => toggleMovingAverage(window)}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: visible ? color : "currentColor" }}
                />
                {label}
              </Button>
            )
          })}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
          No observations are available for this interval.
        </div>
      ) : (
        <>
          <div
            className="h-80 w-full"
            aria-label={`${indicator.symbol} ${interval} line chart`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value: number) =>
                    formatAxisTick(value, interval, span)
                  }
                  minTickGap={42}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value: number) => formatNumber(value, 2)}
                />
                <Tooltip
                  content={
                    <ObservationTooltip
                      visibleAverages={visibleAverages}
                      interval={interval}
                    />
                  }
                  cursor={{
                    stroke: "var(--muted-foreground)",
                    strokeDasharray: "4 4",
                    strokeWidth: 1,
                  }}
                />
                <Line
                  type="linear"
                  dataKey="value"
                  name="Value"
                  stroke="#0f766e"
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 3.5, strokeWidth: 0, fill: "#0f766e" }}
                  isAnimationActive={false}
                />
                {movingAverageLines
                  .filter(({ window }) => visibleAverages.includes(window))
                  .map(({ key, label, color }) => (
                    <Line
                      key={key}
                      type="linear"
                      dataKey={key}
                      name={label}
                      stroke={color}
                      strokeWidth={1.3}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-right text-[11px] text-muted-foreground">
            {interval} · latest {formatNumber(data.length, 0)}
            {total > DEFAULT_CHART_POINT_LIMIT
              ? ` of ${formatNumber(total, 0)}`
              : ""}{" "}
            points · UTC
          </p>
        </>
      )}
    </div>
  )
}
