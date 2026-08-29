import { normalizeFredObservations } from "@/lib/data-providers/fred/normalize"
import type { FredObservationClient } from "@/lib/data-providers/fred/types"
import type {
  FetchObservationsInput,
  ObservationBatch,
  TimeSeriesProvider,
} from "@/lib/data-providers/types"

export class FredTimeSeriesProvider implements TimeSeriesProvider {
  readonly id = "fred"

  constructor(private readonly client: FredObservationClient) {}

  async fetchObservations(
    input: FetchObservationsInput
  ): Promise<ObservationBatch> {
    const response = await this.client.fetchSeriesObservations({
      seriesId: input.providerSeriesId,
      startDate: input.startDate,
      endDate: input.endDate,
    })
    return normalizeFredObservations(
      response.observations,
      input.providerSeriesId
    )
  }
}
