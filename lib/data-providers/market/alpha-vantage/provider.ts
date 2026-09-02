import { assertDailyInterval } from "@/lib/data-providers/market/daily-only"
import { normalizeMarketObservations } from "@/lib/data-providers/market/normalize"
import type { MarketObservationCandidate } from "@/lib/data-providers/market/types"
import type {
  FetchObservationsInput,
  ObservationBatch,
  TimeSeriesProvider,
} from "@/lib/data-providers/types"

const DEFAULT_ENDPOINT = "https://www.alphavantage.co/query"

export class AlphaVantageConfigurationError extends Error {
  constructor() {
    super(
      "ALPHA_VANTAGE_API_KEY is not configured. Add it to .env.local before syncing GOLD."
    )
    this.name = "AlphaVantageConfigurationError"
  }
}

export class AlphaVantageApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AlphaVantageApiError"
  }
}

interface AlphaVantageGoldProviderOptions {
  apiKey?: string
  fetcher?: typeof fetch
  endpoint?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function responseError(payload: Record<string, unknown>): string | null {
  for (const key of ["Error Message", "Information", "Note", "message"]) {
    const value = payload[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function extractRows(payload: unknown): MarketObservationCandidate[] {
  if (!isRecord(payload)) {
    throw new AlphaVantageApiError(
      "Alpha Vantage returned an invalid response object."
    )
  }

  const providerError = responseError(payload)
  if (providerError) throw new AlphaVantageApiError(providerError)

  const arrayRows = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.values)
      ? payload.values
      : null

  if (arrayRows) {
    return arrayRows.map((value) => {
      if (!isRecord(value)) return { timestamp: undefined, close: undefined }
      return {
        timestamp: value.date ?? value.datetime ?? value.timestamp,
        close: value.value ?? value.close ?? value.price,
        metadata: {
          quote_currency: "USD",
          instrument_definition: "xau_usd_spot",
        },
      }
    })
  }

  const seriesEntry = Object.entries(payload).find(
    ([key, value]) =>
      key.toLowerCase().includes("time series") && isRecord(value)
  )
  if (seriesEntry && isRecord(seriesEntry[1])) {
    return Object.entries(seriesEntry[1]).map(([date, value]) => ({
      timestamp: date,
      close: isRecord(value)
        ? value["4. close"] ?? value.close ?? value.value
        : undefined,
      metadata: {
        quote_currency: "USD",
        instrument_definition: "xau_usd_spot",
      },
    }))
  }

  throw new AlphaVantageApiError(
    "Alpha Vantage returned no recognized gold history payload."
  )
}

export class AlphaVantageGoldProvider implements TimeSeriesProvider {
  readonly id = "alpha_vantage"
  readonly kind = "market" as const
  readonly instrumentMetadataKey = "provider_symbol"
  readonly capabilities = ["daily", "commodity"] as const

  private readonly apiKey?: string
  private readonly fetcher: typeof fetch
  private readonly endpoint: string

  constructor(options: AlphaVantageGoldProviderOptions = {}) {
    this.apiKey = options.apiKey?.trim() || undefined
    this.fetcher = options.fetcher ?? fetch
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  }

  supportsInstrument(providerInstrumentId: string): boolean {
    return providerInstrumentId === "XAU" || providerInstrumentId === "GOLD"
  }

  async fetchObservations(
    input: FetchObservationsInput
  ): Promise<ObservationBatch> {
    assertDailyInterval(this.id, input.interval)
    if (!this.apiKey) throw new AlphaVantageConfigurationError()

    const url = new URL(this.endpoint)
    url.searchParams.set("function", "GOLD_SILVER_HISTORY")
    url.searchParams.set("symbol", input.providerInstrumentId)
    url.searchParams.set("interval", "daily")
    url.searchParams.set("apikey", this.apiKey)

    let response: Response
    try {
      response = await this.fetcher(url)
    } catch {
      throw new AlphaVantageApiError(
        "Alpha Vantage could not be reached while fetching gold history."
      )
    }
    if (!response.ok) {
      throw new AlphaVantageApiError(
        `Alpha Vantage request failed with HTTP ${response.status}.`
      )
    }

    const rows = extractRows(await response.json()).filter((row) => {
      if (typeof row.timestamp !== "string") return true
      const date = row.timestamp.slice(0, 10)
      return date >= input.startDate && (!input.endDate || date <= input.endDate)
    })

    return normalizeMarketObservations(rows, {
      providerId: this.id,
      providerSymbol: input.providerInstrumentId,
      priceType: "close",
    })
  }
}
