import { describe, expect, it } from "vitest"

import type { Indicator, Observation } from "@/lib/domain/indicators"
import {
  aggregateObservations,
  getSupportedChartIntervals,
  takeLatestChartPoints,
} from "@/lib/indicators/chart-series"

function observation(
  observedAt: string,
  value: number,
  fields: Partial<Observation> = {}
): Observation {
  return {
    id: observedAt,
    indicatorId: "indicator-1",
    observedAt,
    value,
    open: null,
    high: null,
    low: null,
    close: null,
    volume: null,
    buyVolume: null,
    metadata: {},
    ...fields,
  }
}

function indicator(fields: Partial<Indicator> = {}): Indicator {
  return {
    id: "indicator-1",
    symbol: "TEST",
    name: "Test",
    category: "test",
    source: "mock",
    unit: "points",
    frequency: "daily",
    metadata: {},
    observations: [],
    ...fields,
  }
}

describe("aggregateObservations", () => {
  it("aggregates market OHLCV observations into a UTC week", () => {
    const result = aggregateObservations(
      [
        observation("2026-08-24T00:00:00.000Z", 11, {
          open: 10,
          high: 12,
          low: 9,
          close: 11,
          volume: 100,
          buyVolume: 60,
        }),
        observation("2026-08-25T00:00:00.000Z", 13, {
          open: 11,
          high: 14,
          low: 10,
          close: 13,
          volume: 150,
          buyVolume: 80,
        }),
      ],
      "1W"
    )

    expect(result).toEqual([
      expect.objectContaining({
        periodStart: "2026-08-24T00:00:00.000Z",
        periodEnd: "2026-08-25T00:00:00.000Z",
        value: 13,
        open: 10,
        high: 14,
        low: 9,
        close: 13,
        volume: 250,
        buyVolume: 140,
        sourcePointCount: 2,
      }),
    ])
  })

  it("keeps FRED periods as point values without inventing OHLCV", () => {
    const result = aggregateObservations(
      [
        observation("2026-08-24T00:00:00.000Z", 4.2),
        observation("2026-08-25T00:00:00.000Z", 4.3),
      ],
      "1W"
    )

    expect(result[0]).toMatchObject({
      value: 4.3,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: null,
      buyVolume: null,
    })
  })

  it("uses UTC calendar month boundaries", () => {
    const result = aggregateObservations(
      [
        observation("2026-01-31T23:00:00.000Z", 1),
        observation("2026-02-01T00:00:00.000Z", 2),
      ],
      "1M"
    )

    expect(result.map((point) => new Date(point.time).toISOString())).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
    ])
  })
})

describe("getSupportedChartIntervals", () => {
  it("disables intraday intervals for FRED daily series", () => {
    const supported = getSupportedChartIntervals(
      indicator({ source: "fred", metadata: { provider: "fred" } })
    )

    expect(supported.has("5H")).toBe(false)
    expect(supported.has("1D")).toBe(true)
    expect(supported.has("1W")).toBe(true)
    expect(supported.has("1M")).toBe(true)
  })

  it("enables every interval for a one-minute market series", () => {
    const supported = getSupportedChartIntervals(
      indicator({
        source: "market",
        frequency: "minute",
        metadata: { provider: "market", minimum_interval: "1m" },
      })
    )

    expect([...supported]).toHaveLength(9)
  })
})

describe("takeLatestChartPoints", () => {
  it("keeps the latest 240 buckets by default", () => {
    const points = Array.from({ length: 300 }, (_, index) => index)

    const visible = takeLatestChartPoints(points)

    expect(visible).toHaveLength(240)
    expect(visible[0]).toBe(60)
    expect(visible.at(-1)).toBe(299)
  })

  it("keeps all buckets when fewer than the limit are available", () => {
    expect(takeLatestChartPoints([1, 2, 3])).toEqual([1, 2, 3])
  })
})
