import { normalizeMarketObservations } from "@/lib/data-providers/market/normalize"
import type { MarketObservationCandidate } from "@/lib/data-providers/market/types"
import type {
  FetchObservationsInput,
  ObservationBatch,
  TimeSeriesProvider,
  TimeSeriesProviderCapability,
} from "@/lib/data-providers/types"
import { UnsupportedProviderInstrumentError } from "@/lib/data-providers/registry"

interface MockMarketProviderOptions {
  id?: string
  responses: Record<string, MarketObservationCandidate[]>
  capabilities?: readonly TimeSeriesProviderCapability[]
  error?: Error
}

/** Test/development adapter only. Never register this as a production source. */
export class MockMarketProvider implements TimeSeriesProvider {
  readonly id: string
  readonly kind = "market" as const
  readonly instrumentMetadataKey = "provider_symbol"
  readonly capabilities: readonly TimeSeriesProviderCapability[]
  readonly requests: FetchObservationsInput[] = []

  private readonly responses: Record<string, MarketObservationCandidate[]>
  private readonly error?: Error

  constructor(options: MockMarketProviderOptions) {
    this.id = options.id ?? "mock_market"
    this.responses = options.responses
    this.capabilities = options.capabilities ?? ["daily"]
    this.error = options.error
  }

  supportsInstrument(providerInstrumentId: string): boolean {
    return Object.hasOwn(this.responses, providerInstrumentId)
  }

  async fetchObservations(
    input: FetchObservationsInput
  ): Promise<ObservationBatch> {
    this.requests.push(input)
    if (this.error) throw this.error

    const rows = this.responses[input.providerInstrumentId]
    if (!rows) {
      throw new UnsupportedProviderInstrumentError(
        this.id,
        input.providerInstrumentId
      )
    }

    const inRange = rows.filter((row) => {
      if (typeof row.timestamp !== "string") return true
      const date = row.timestamp.slice(0, 10)
      return date >= input.startDate && (!input.endDate || date <= input.endDate)
    })

    return normalizeMarketObservations(inRange, {
      providerId: this.id,
      providerSymbol: input.providerInstrumentId,
      priceType: "close",
    })
  }
}
