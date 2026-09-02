import { describe, expect, it, vi } from "vitest"

import {
  AlphaVantageApiError,
  AlphaVantageConfigurationError,
  AlphaVantageGoldProvider,
} from "@/lib/data-providers/market/alpha-vantage/provider"

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("AlphaVantageGoldProvider", () => {
  it("requires a key only when GOLD is fetched", async () => {
    const provider = new AlphaVantageGoldProvider()

    await expect(
      provider.fetchObservations({
        providerInstrumentId: "XAU",
        startDate: "2026-08-01",
        interval: "1d",
      })
    ).rejects.toBeInstanceOf(AlphaVantageConfigurationError)
  })

  it("normalizes and date-filters official gold history rows", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [
          { date: "2026-07-31", value: "2400.1" },
          { date: "2026-08-01", value: "2410.2" },
          { date: "2026-08-03", value: "2420.3" },
        ],
      })
    )
    const provider = new AlphaVantageGoldProvider({
      apiKey: "test-key",
      fetcher,
    })

    const result = await provider.fetchObservations({
      providerInstrumentId: "XAU",
      startDate: "2026-08-01",
      endDate: "2026-08-02",
      interval: "1d",
    })

    const requestedUrl = new URL(String(fetcher.mock.calls[0]?.[0]))
    expect(requestedUrl.searchParams.get("function")).toBe(
      "GOLD_SILVER_HISTORY"
    )
    expect(requestedUrl.searchParams.get("symbol")).toBe("XAU")
    expect(requestedUrl.searchParams.get("interval")).toBe("daily")
    expect(result.observations).toHaveLength(1)
    expect(result.observations[0]).toMatchObject({
      value: 2410.2,
      metadata: {
        provider: "alpha_vantage",
        provider_symbol: "XAU",
        instrument_definition: "xau_usd_spot",
      },
    })
  })

  it("returns a provider error without exposing the API key", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ Note: "Rate limit reached" }))
    const provider = new AlphaVantageGoldProvider({
      apiKey: "secret-test-key",
      fetcher,
    })

    const promise = provider.fetchObservations({
      providerInstrumentId: "XAU",
      startDate: "2026-08-01",
      interval: "1d",
    })

    await expect(promise).rejects.toBeInstanceOf(AlphaVantageApiError)
    await expect(promise).rejects.not.toThrow(/secret-test-key/)
  })
})
