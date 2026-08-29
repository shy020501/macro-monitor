export interface FredSeriesObservationsResponse {
  observations: unknown[]
}

export interface FredObservationClient {
  fetchSeriesObservations(input: {
    seriesId: string
    startDate: string
    endDate?: string
  }): Promise<FredSeriesObservationsResponse>
}
