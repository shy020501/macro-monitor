import { describe, expect, it } from "vitest"

import { FredApiError, FredClient } from "@/lib/data-providers/fred/client"
import {
  FredConfigurationError,
  getFredApiKey,
} from "@/lib/data-providers/fred/config"

describe("FredClient", () => {
  it("requests series observations with the expected range", async () => {
    let requestedUrl = ""
    const fetchFn: typeof fetch = async (input) => {
      requestedUrl = String(input)
      return Response.json({
        observations: [{ date: "2026-08-24", value: "4.5" }],
      })
    }
    const client = new FredClient({
      apiKey: "test-key",
      fetchFn,
    })

    const result = await client.fetchSeriesObservations({
      seriesId: "DGS10",
      startDate: "2026-08-01",
      endDate: "2026-08-24",
    })

    expect(result.observations).toHaveLength(1)
    expect(requestedUrl).not.toBe("")
    const searchParams = new URL(requestedUrl).searchParams
    expect(searchParams.get("series_id")).toBe("DGS10")
    expect(searchParams.get("observation_start")).toBe(
      "2026-08-01"
    )
    expect(searchParams.get("observation_end")).toBe("2026-08-24")
    expect(searchParams.get("file_type")).toBe("json")
  })

  it("surfaces an HTTP/API error without logging the request URL", async () => {
    const client = new FredClient({
      apiKey: "secret-test-key",
      fetchFn: (async () =>
        Response.json(
          { error_code: 400, error_message: "Bad Request." },
          { status: 400 }
        )) as typeof fetch,
    })

    await expect(
      client.fetchSeriesObservations({
        seriesId: "DGS10",
        startDate: "2026-08-01",
      })
    ).rejects.toMatchObject({
      name: "FredApiError",
      status: 400,
      message: "FRED request failed (HTTP 400): Bad Request.",
    })
  })

  it("rejects a malformed successful response", async () => {
    const client = new FredClient({
      apiKey: "test-key",
      fetchFn: (async () => Response.json({ count: 1 })) as typeof fetch,
    })

    await expect(
      client.fetchSeriesObservations({
        seriesId: "DGS10",
        startDate: "2026-08-01",
      })
    ).rejects.toBeInstanceOf(FredApiError)
  })

  it("redacts the API key if a network error happens to include it", async () => {
    const client = new FredClient({
      apiKey: "secret-test-key",
      fetchFn: (async () => {
        throw new Error("request contained secret-test-key")
      }) as typeof fetch,
    })

    await expect(
      client.fetchSeriesObservations({
        seriesId: "DGS10",
        startDate: "2026-08-01",
      })
    ).rejects.toThrow("request contained [REDACTED]")
  })
})

describe("getFredApiKey", () => {
  it("returns a configured server-side key", () => {
    expect(getFredApiKey({ FRED_API_KEY: " test-key " })).toBe("test-key")
  })

  it("returns a clear error when the key is missing", () => {
    expect(() => getFredApiKey({})).toThrowError(FredConfigurationError)
    expect(() => getFredApiKey({})).toThrow("FRED_API_KEY is not configured")
  })
})
