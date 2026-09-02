import { describe, expect, it } from "vitest"

import { normalizeMarketObservations } from "@/lib/data-providers/market/normalize"

const context = {
  providerId: "mock_market",
  providerSymbol: "MOCK:ASSET",
} as const

describe("normalizeMarketObservations", () => {
  it("normalizes daily and timezone-qualified market close values", () => {
    const result = normalizeMarketObservations(
      [
        { timestamp: "2026-08-24", close: "104.25" },
        {
          timestamp: "2026-08-24T15:30:00+09:00",
          close: 105,
          metadata: { session: "regular" },
        },
      ],
      context
    )

    expect(result).toEqual({
      observations: [
        {
          observedAt: "2026-08-24T00:00:00.000Z",
          value: 104.25,
          metadata: {
            provider: "mock_market",
            provider_symbol: "MOCK:ASSET",
            price_type: "close",
          },
        },
        {
          observedAt: "2026-08-24T06:30:00.000Z",
          value: 105,
          metadata: {
            session: "regular",
            provider: "mock_market",
            provider_symbol: "MOCK:ASSET",
            price_type: "close",
          },
        },
      ],
      fetchedCount: 2,
      skippedCount: 0,
    })
  })

  it("skips invalid numeric values, missing timestamps, and ambiguous local times", () => {
    const result = normalizeMarketObservations(
      [
        { timestamp: "2026-08-24", close: "not-a-number" },
        { close: 100 },
        { timestamp: "2026-08-24T10:00:00", close: 100 },
        { timestamp: "2026-02-30", close: 100 },
      ],
      context
    )

    expect(result.observations).toEqual([])
    expect(result).toMatchObject({ fetchedCount: 4, skippedCount: 4 })
  })

  it("accepts an empty response", () => {
    expect(normalizeMarketObservations([], context)).toEqual({
      observations: [],
      fetchedCount: 0,
      skippedCount: 0,
    })
  })

  it("preserves valid OHLCV data and rejects partial candles", () => {
    const result = normalizeMarketObservations(
      [
        {
          timestamp: "2026-08-24",
          open: "100",
          high: 105,
          low: 98,
          close: "103",
          volume: "12500",
        },
        {
          timestamp: "2026-08-25",
          open: 103,
          close: 104,
        },
      ],
      context
    )

    expect(result.observations).toHaveLength(1)
    expect(result.observations[0]).toMatchObject({
      value: 103,
      open: 100,
      high: 105,
      low: 98,
      close: 103,
      volume: 12_500,
    })
    expect(result.skippedCount).toBe(1)
  })

  it("uses the last valid correction for a duplicate timestamp", () => {
    const result = normalizeMarketObservations(
      [
        { timestamp: "2026-08-24", close: 100 },
        { timestamp: "2026-08-24", close: 101 },
      ],
      context
    )

    expect(result.observations).toHaveLength(1)
    expect(result.observations[0]?.value).toBe(101)
    expect(result.skippedCount).toBe(1)
  })
})
