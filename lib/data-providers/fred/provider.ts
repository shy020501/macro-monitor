import { normalizeFredObservations } from "@/lib/data-providers/fred/normalize"
import type { FredObservationClient } from "@/lib/data-providers/fred/types"
import type {
  FetchObservationsInput,
  ObservationBatch,
  TimeSeriesProvider,
} from "@/lib/data-providers/types"

export class FredTimeSeriesProvider implements TimeSeriesProvider {
  readonly id = "fred"
  readonly kind = "economic" as const
  readonly instrumentMetadataKey = "provider_series_id"
  readonly capabilities = ["daily"] as const

  constructor(private readonly client: FredObservationClient) {}

  async fetchObservations(
    input: FetchObservationsInput
  ): Promise<ObservationBatch> {
    const response = await this.client.fetchSeriesObservations({
      seriesId: input.providerInstrumentId,
      startDate: input.startDate,
      endDate: input.endDate,
    })
    return normalizeFredObservations(
      response.observations,
      input.providerInstrumentId
    )
  }
}
