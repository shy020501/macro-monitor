import { describe, expect, it, vi } from "vitest"

import { DailyMarketProviderOnlyError } from "@/lib/data-providers/market/daily-only"
import {
  parseYFinanceBridgeOutput,
  YahooFinanceProvider,
  YFinanceRuntimeError,
  type YFinanceBridgeRunner,
} from "@/lib/data-providers/market/yahoo-finance/provider"

describe("YahooFinanceProvider", () => {
  it("supports every active Yahoo daily instrument", () => {
    const provider = new YahooFinanceProvider(vi.fn<YFinanceBridgeRunner>())

    for (const symbol of [
      "DX-Y.NYB",
      "^TNX",
      "^GSPC",
      "^IXIC",
      "^VIX",
      "^KS11",
      "^KQ11",
      "KRW=X",
      "JPY=X",
      "CL=F",
      "HG=F",
    ]) {
      expect(provider.supportsInstrument(symbol), symbol).toBe(true)
    }
  })

  it("forwards a daily range and normalizes bridge OHLCV rows", async () => {
    const runBridge = vi.fn<YFinanceBridgeRunner>().mockResolvedValue({
      rows: [
        {
          timestamp: "2026-08-24",
          open: 100,
          high: 105,
          low: 98,
          close: 103,
          volume: 12_500,
        },
      ],
    })
    const provider = new YahooFinanceProvider(runBridge)

    const result = await provider.fetchObservations({
      providerInstrumentId: "^GSPC",
      startDate: "2026-08-01",
      endDate: "2026-08-24",
      interval: "1d",
    })

    expect(runBridge).toHaveBeenCalledWith({
      symbol: "^GSPC",
      startDate: "2026-08-01",
      endDate: "2026-08-24",
      interval: "1d",
    })
    expect(result.observations[0]).toMatchObject({
      value: 103,
      open: 100,
      high: 105,
      low: 98,
      close: 103,
      volume: 12_500,
      metadata: {
        provider: "yahoo_finance",
        provider_symbol: "^GSPC",
        price_type: "close",
      },
    })
  })

  it("rejects sub-daily requests", async () => {
    const runBridge = vi.fn<YFinanceBridgeRunner>()
    const provider = new YahooFinanceProvider(runBridge)

    await expect(
      provider.fetchObservations({
        providerInstrumentId: "^GSPC",
        startDate: "2026-08-01",
        interval: "5m",
      })
    ).rejects.toBeInstanceOf(DailyMarketProviderOnlyError)
    expect(runBridge).not.toHaveBeenCalled()
  })

  it("rejects malformed Python bridge output", () => {
    expect(() => parseYFinanceBridgeOutput("not json")).toThrow(
      YFinanceRuntimeError
    )
    expect(() => parseYFinanceBridgeOutput('{"value": 1}')).toThrow(
      YFinanceRuntimeError
    )
  })
})
