import { describe, expect, it } from "vitest"

import type {
  FetchObservationsInput,
  ObservationBatch,
  TimeSeriesProvider,
} from "@/lib/data-providers/types"
import {
  InvalidSyncRangeError,
  UnmappedIndicatorError,
  syncFredIndicator,
} from "@/lib/ingestion/fred-sync"
import type {
  IngestionIndicator,
  ObservationIngestionStore,
  PointObservationWrite,
  StoredObservationRecord,
} from "@/lib/ingestion/types"

const US10Y: IngestionIndicator = {
  id: "indicator-us10y",
  symbol: "US10Y",
  source: "mock",
  metadata: { sample: true },
}

class FakeProvider implements TimeSeriesProvider {
  readonly id = "fred"
  readonly requests: FetchObservationsInput[] = []

  constructor(private readonly batch: ObservationBatch) {}

  async fetchObservations(
    input: FetchObservationsInput
  ): Promise<ObservationBatch> {
    this.requests.push(input)
    return this.batch
  }
}

class MemoryStore implements ObservationIngestionStore {
  readonly indicators = new Map<string, IngestionIndicator>()
  readonly observations = new Map<string, StoredObservationRecord>()
  providerUpdates = 0

  constructor(indicators: IngestionIndicator[] = [US10Y]) {
    for (const indicator of indicators) {
      this.indicators.set(indicator.id, structuredClone(indicator))
    }
  }

  private key(indicatorId: string, observedAt: string): string {
    return `${indicatorId}|${observedAt}`
  }

  seedObservation(
    indicatorId: string,
    observation: StoredObservationRecord
  ): void {
    this.observations.set(
      this.key(indicatorId, observation.observedAt),
      structuredClone(observation)
    )
  }

  async getIndicatorById(indicatorId: string) {
    return this.indicators.get(indicatorId) ?? null
  }

  async getIndicatorBySymbol(symbol: string) {
    return (
      [...this.indicators.values()].find(
        (indicator) => indicator.symbol === symbol
      ) ?? null
    )
  }

  async getLatestObservedAt(indicatorId: string) {
    const dates = [...this.observations.entries()]
      .filter(([key]) => key.startsWith(`${indicatorId}|`))
      .map(([, observation]) => observation.observedAt)
      .sort()
    return dates.at(-1) ?? null
  }

  async getExistingObservations(
    indicatorId: string,
    observedAts: string[]
  ) {
    return observedAts.flatMap((observedAt) => {
      const row = this.observations.get(this.key(indicatorId, observedAt))
      return row ? [structuredClone(row)] : []
    })
  }

  async upsertPointObservations(
    indicatorId: string,
    observations: PointObservationWrite[]
  ) {
    for (const observation of observations) {
      this.seedObservation(indicatorId, {
        ...observation,
        open: null,
        high: null,
        low: null,
        close: null,
        volume: null,
        buyVolume: null,
      })
    }
  }

  async updateIndicatorProvider(
    indicator: IngestionIndicator,
    provider: string,
    providerSeriesId: string
  ) {
    this.providerUpdates += 1
    this.indicators.set(indicator.id, {
      ...indicator,
      source: provider,
      metadata: {
        ...indicator.metadata,
        provider,
        provider_series_id: providerSeriesId,
      },
    })
  }
}

function fredBatch(
  observedAt = "2026-08-24T00:00:00.000Z",
  value = 4.5
): ObservationBatch {
  return {
    observations: [
      {
        observedAt,
        value,
        metadata: { provider: "fred", provider_series_id: "DGS10" },
      },
    ],
    fetchedCount: 1,
    skippedCount: 0,
  }
}

describe("syncFredIndicator", () => {
  it("inserts a new normalized point observation", async () => {
    const store = new MemoryStore()
    const provider = new FakeProvider(fredBatch())

    const result = await syncFredIndicator(
      { indicatorId: US10Y.id, startDate: "2026-08-01" },
      { store, provider }
    )

    expect(result).toMatchObject({
      indicator: "US10Y",
      providerSeriesId: "DGS10",
      fetched: 1,
      valid: 1,
      upserted: 1,
      skipped: 0,
      from: "2026-08-01",
    })
    expect(store.observations).toHaveLength(1)
    expect(store.providerUpdates).toBe(1)
  })

  it("is idempotent for the same indicator and timestamp", async () => {
    const store = new MemoryStore()
    const provider = new FakeProvider(fredBatch())
    const input = { indicatorId: US10Y.id, startDate: "2026-08-01" }

    await syncFredIndicator(input, { store, provider })
    const second = await syncFredIndicator(input, { store, provider })

    expect(store.observations).toHaveLength(1)
    expect(second.upserted).toBe(0)
    expect(second.skipped).toBe(1)
  })

  it("updates a changed value and clears stale seed OHLC", async () => {
    const store = new MemoryStore()
    store.seedObservation(US10Y.id, {
      observedAt: "2026-08-24T00:00:00.000Z",
      value: 4.25,
      open: 4.2,
      high: 4.3,
      low: 4.1,
      close: 4.25,
      volume: 1_000,
      buyVolume: 600,
      metadata: { sample: true, provider: "seed" },
    })
    const provider = new FakeProvider(fredBatch(undefined, 4.5))

    const result = await syncFredIndicator(
      { indicatorId: US10Y.id, startDate: "2026-08-24" },
      { store, provider }
    )
    const updated = [...store.observations.values()][0]

    expect(result.upserted).toBe(1)
    expect(updated).toMatchObject({
      value: 4.5,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: null,
      buyVolume: null,
      metadata: { provider: "fred", provider_series_id: "DGS10" },
    })
  })

  it("rejects an indicator without a verified mapping", async () => {
    const dxy: IngestionIndicator = {
      id: "indicator-dxy",
      symbol: "DXY",
      source: "mock",
      metadata: {},
    }
    const store = new MemoryStore([dxy])
    const provider = new FakeProvider(fredBatch())

    await expect(
      syncFredIndicator(
        { indicatorId: dxy.id, startDate: "2026-08-01" },
        { store, provider }
      )
    ).rejects.toBeInstanceOf(UnmappedIndicatorError)
    expect(provider.requests).toHaveLength(0)
  })

  it("starts incremental sync on the UTC day after the latest observation", async () => {
    const store = new MemoryStore()
    store.seedObservation(US10Y.id, {
      observedAt: "2026-08-20T00:00:00.000Z",
      value: 4.25,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: null,
      buyVolume: null,
      metadata: { provider: "fred", provider_series_id: "DGS10" },
    })
    const provider = new FakeProvider({
      observations: [],
      fetchedCount: 0,
      skippedCount: 0,
    })

    await syncFredIndicator(
      { indicatorId: US10Y.id },
      { store, provider }
    )

    expect(provider.requests[0]?.startDate).toBe("2026-08-21")
  })

  it("uses an explicit start date for a first sync", async () => {
    const store = new MemoryStore()
    const provider = new FakeProvider({
      observations: [],
      fetchedCount: 0,
      skippedCount: 0,
    })

    await syncFredIndicator(
      { indicatorId: US10Y.id, startDate: "2020-01-01" },
      { store, provider }
    )

    expect(provider.requests[0]?.startDate).toBe("2020-01-01")
  })

  it("requires a start date when no incremental cursor exists", async () => {
    const store = new MemoryStore()
    const provider = new FakeProvider(fredBatch())

    await expect(
      syncFredIndicator({ indicatorId: US10Y.id }, { store, provider })
    ).rejects.toBeInstanceOf(InvalidSyncRangeError)
    expect(provider.requests).toHaveLength(0)
  })
})
