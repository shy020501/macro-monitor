import type {
  FredObservationClient,
  FredSeriesObservationsResponse,
} from "@/lib/data-providers/fred/types"

const DEFAULT_BASE_URL = "https://api.stlouisfed.org/fred"
const DEFAULT_TIMEOUT_MS = 10_000

interface FredClientOptions {
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
  fetchFn?: typeof fetch
}

export class FredApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = "FredApiError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new FredApiError(
      `FRED returned malformed JSON (HTTP ${response.status}).`,
      response.status
    )
  }
}

export class FredClient implements FredObservationClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly fetchFn: typeof fetch

  constructor(options: FredClientOptions) {
    if (!options.apiKey.trim()) {
      throw new FredApiError("A non-empty FRED API key is required.")
    }

    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchFn = options.fetchFn ?? fetch
  }

  private redactSecret(message: string): string {
    return message.replaceAll(this.apiKey, "[REDACTED]")
  }

  async fetchSeriesObservations(input: {
    seriesId: string
    startDate: string
    endDate?: string
  }): Promise<FredSeriesObservationsResponse> {
    const url = new URL(`${this.baseUrl}/series/observations`)
    url.searchParams.set("series_id", input.seriesId)
    url.searchParams.set("api_key", this.apiKey)
    url.searchParams.set("file_type", "json")
    url.searchParams.set("sort_order", "asc")
    url.searchParams.set("observation_start", input.startDate)
    if (input.endDate) {
      url.searchParams.set("observation_end", input.endDate)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    let response: Response
    try {
      response = await this.fetchFn(url, { signal: controller.signal })
    } catch (error) {
      if (controller.signal.aborted) {
        throw new FredApiError(
          `FRED request timed out after ${this.timeoutMs}ms.`
        )
      }
      throw new FredApiError(
        `FRED request failed: ${this.redactSecret(error instanceof Error ? error.message : "network error")}`
      )
    } finally {
      clearTimeout(timeout)
    }

    const payload = await readJson(response)

    if (!response.ok) {
      const providerMessage =
        isRecord(payload) && typeof payload.error_message === "string"
          ? payload.error_message
          : response.statusText || "unknown error"
      throw new FredApiError(
        `FRED request failed (HTTP ${response.status}): ${this.redactSecret(providerMessage)}`,
        response.status
      )
    }

    if (!isRecord(payload) || !Array.isArray(payload.observations)) {
      throw new FredApiError(
        "FRED returned a malformed response: observations must be an array.",
        response.status
      )
    }

    return { observations: payload.observations }
  }
}
