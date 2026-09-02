import { describe, expect, it } from "vitest"

import { MockMarketProvider } from "@/lib/data-providers/market/mock-provider"
import {
  createProviderRegistry,
  ProviderConfigurationError,
  ProviderKindMismatchError,
  ProviderNotConfiguredError,
  UnsupportedProviderInstrumentError,
} from "@/lib/data-providers/registry"
import type {
  ObservationBatch,
  TimeSeriesProvider,
} from "@/lib/data-providers/types"
import {
  IntradayMarketSyncDisabledError,
  syncMarketIndicator,
} from "@/lib/ingestion/market-sync"
import type {
  IngestionIndicator,
  ObservationWrite,
  ObservationIngestionStore,
  StoredObservationRecord,
} from "@/lib/ingestion/types"

const MARKET_DXY: IngestionIndicator = {
  id: "indicator-market-dxy",
  symbol: "DXY",
  source: "mock_market",
  metadata: {
    provider: "mock_market",
    provider_symbol: "MOCK:DXY",
  },
}

class MemoryStore implements ObservationIngestionStore {
  readonly indicators = new Map<string, IngestionIndicator>()
  readonly observations = new Map<string, StoredObservationRecord>()
  providerUpdates = 0

  constructor(indicators: IngestionIndicator[] = [MARKET_DXY]) {
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

  async upsertObservations(
    indicatorId: string,
    observations: ObservationWrite[]
  ) {
    for (const observation of observations) {
      this.seedObservation(indicatorId, observation)
    }
  }

  async deleteObservationsExceptProvider(
    indicatorId: string,
    provider: string
  ) {
    for (const [key, observation] of this.observations) {
      if (
        key.startsWith(`${indicatorId}|`) &&
        observation.metadata.provider !== provider
      ) {
        this.observations.delete(key)
      }
    }
  }

  async updateIndicatorProvider(
    indicator: IngestionIndicator,
    provider: string,
    providerMetadata: Record<string, unknown>
  ) {
    this.providerUpdates += 1
    this.indicators.set(indicator.id, {
      ...indicator,
      source: provider,
      metadata: { ...indicator.metadata, ...providerMetadata, provider },
    })
  }
}

function marketProvider(
  rows = [{ timestamp: "2026-08-24", close: 104.5 }],
  id = "mock_market"
) {
  return new MockMarketProvider({
    id,
    responses: { "MOCK:DXY": rows },
  })
}

class FakeFredProvider implements TimeSeriesProvider {
  readonly id = "fred"
  readonly kind = "economic" as const
  readonly instrumentMetadataKey = "provider_series_id"
  readonly capabilities = ["daily"] as const

  async fetchObservations(): Promise<ObservationBatch> {
    return { observations: [], fetchedCount: 0, skippedCount: 0 }
  }
}

describe("syncMarketIndicator", () => {
  it("temporarily rejects sub-daily sync before provider resolution", async () => {
    const provider = marketProvider()

    await expect(
      syncMarketIndicator(
        {
          indicatorId: MARKET_DXY.id,
          startDate: "2026-08-01",
          interval: "5m",
        },
        {
          store: new MemoryStore(),
          providers: createProviderRegistry([provider]),
        }
      )
    ).rejects.toBeInstanceOf(IntradayMarketSyncDisabledError)
    expect(provider.requests).toHaveLength(0)
  })

  it("inserts a normalized close with source provenance", async () => {
    const store = new MemoryStore()
    const provider = marketProvider()

    const result = await syncMarketIndicator(
      { indicatorId: MARKET_DXY.id, startDate: "2026-08-01" },
      { store, providers: createProviderRegistry([provider]) }
    )
    const inserted = [...store.observations.values()][0]

    expect(result).toMatchObject({
      indicator: "DXY",
      provider: "mock_market",
      providerSymbol: "MOCK:DXY",
      providerInstrumentId: "MOCK:DXY",
      upserted: 1,
    })
    expect(inserted).toMatchObject({
      value: 104.5,
      open: null,
      high: null,
      low: null,
      close: null,
      metadata: {
        provider: "mock_market",
        provider_symbol: "MOCK:DXY",
        price_type: "close",
      },
    })
  })

  it("is idempotent when the same market sync is repeated", async () => {
    const store = new MemoryStore()
    const provider = marketProvider()
    const dependencies = {
      store,
      providers: createProviderRegistry([provider]),
    }
    const input = {
      indicatorId: MARKET_DXY.id,
      startDate: "2026-08-01",
    }

    await syncMarketIndicator(input, dependencies)
    const second = await syncMarketIndicator(input, dependencies)

    expect(store.observations).toHaveLength(1)
    expect(second.upserted).toBe(0)
    expect(second.skipped).toBe(1)
  })

  it("updates a corrected close and clears stale OHLCV fields", async () => {
    const store = new MemoryStore()
    store.seedObservation(MARKET_DXY.id, {
      observedAt: "2026-08-24T00:00:00.000Z",
      value: 103,
      open: 102,
      high: 105,
      low: 101,
      close: 103,
      volume: 10_000,
      buyVolume: 6_000,
      metadata: {
        provider: "mock_market",
        provider_symbol: "MOCK:DXY",
        price_type: "close",
      },
    })

    const result = await syncMarketIndicator(
      { indicatorId: MARKET_DXY.id, startDate: "2026-08-24" },
      {
        store,
        providers: createProviderRegistry([marketProvider()]),
      }
    )
    const updated = [...store.observations.values()][0]

    expect(result.upserted).toBe(1)
    expect(updated).toMatchObject({
      value: 104.5,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: null,
      buyVolume: null,
    })
  })

  it("allows an explicitly configured market source to replace seed data", async () => {
    const store = new MemoryStore()
    store.seedObservation(MARKET_DXY.id, {
      observedAt: "2026-08-24T00:00:00.000Z",
      value: 100,
      open: 99,
      high: 101,
      low: 98,
      close: 100,
      volume: null,
      buyVolume: null,
      metadata: { provider: "seed", sample: true },
    })

    const result = await syncMarketIndicator(
      { indicatorId: MARKET_DXY.id, startDate: "2026-08-24" },
      {
        store,
        providers: createProviderRegistry([marketProvider()]),
      }
    )

    expect(result.upserted).toBe(1)
    expect([...store.observations.values()][0]?.metadata).toMatchObject({
      provider: "mock_market",
      provider_symbol: "MOCK:DXY",
      price_type: "close",
    })
  })

  it("bootstraps from metadata and removes seed rows after the first live batch", async () => {
    const configured: IngestionIndicator = {
      ...MARKET_DXY,
      metadata: {
        ...MARKET_DXY.metadata,
        sync_start_date: "2000-01-01",
      },
    }
    const store = new MemoryStore([configured])
    store.seedObservation(configured.id, {
      observedAt: "2026-08-24T00:00:00.000Z",
      value: 100,
      open: 99,
      high: 101,
      low: 98,
      close: 100,
      volume: null,
      buyVolume: null,
      metadata: { provider: "seed", sample: true },
    })
    const provider = marketProvider([
      { timestamp: "2026-08-22", close: 104.5 },
    ])

    await syncMarketIndicator(
      { indicatorId: configured.id },
      { store, providers: createProviderRegistry([provider]) }
    )

    expect(provider.requests[0]?.startDate).toBe("2000-01-01")
    expect([...store.observations.values()]).toHaveLength(1)
    expect([...store.observations.values()][0]?.metadata.provider).toBe(
      "mock_market"
    )
  })

  it("requests the UTC day after the latest stored observation", async () => {
    const store = new MemoryStore()
    store.seedObservation(MARKET_DXY.id, {
      observedAt: "2026-08-20T00:00:00.000Z",
      value: 103,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: null,
      buyVolume: null,
      metadata: {
        provider: "mock_market",
        provider_symbol: "MOCK:DXY",
        price_type: "close",
      },
    })
    const provider = marketProvider([])

    await syncMarketIndicator(
      { indicatorId: MARKET_DXY.id },
      { store, providers: createProviderRegistry([provider]) }
    )

    expect(provider.requests[0]?.startDate).toBe("2026-08-21")
  })

  it("rejects an unsupported market instrument before fetching", async () => {
    const unsupported: IngestionIndicator = {
      ...MARKET_DXY,
      id: "indicator-market-gold",
      symbol: "GOLD",
      metadata: {
        provider: "mock_market",
        provider_symbol: "MOCK:GOLD",
      },
    }
    const store = new MemoryStore([unsupported])
    const provider = marketProvider()

    await expect(
      syncMarketIndicator(
        { indicatorId: unsupported.id, startDate: "2026-08-01" },
        { store, providers: createProviderRegistry([provider]) }
      )
    ).rejects.toBeInstanceOf(UnsupportedProviderInstrumentError)
    expect(provider.requests).toHaveLength(0)
  })

  it("does not process a FRED-active indicator as market data", async () => {
    const fredIndicator: IngestionIndicator = {
      id: "indicator-fred-us10y",
      symbol: "US10Y",
      source: "fred",
      metadata: { provider: "fred", provider_series_id: "DGS10" },
    }
    const store = new MemoryStore([fredIndicator])

    await expect(
      syncMarketIndicator(
        { indicatorId: fredIndicator.id, startDate: "2026-08-01" },
        {
          store,
          providers: createProviderRegistry([new FakeFredProvider()]),
        }
      )
    ).rejects.toBeInstanceOf(ProviderKindMismatchError)
  })

  it("rejects source and metadata.provider disagreement", async () => {
    const invalid: IngestionIndicator = {
      ...MARKET_DXY,
      metadata: {
        provider: "another_provider",
        provider_symbol: "MOCK:DXY",
      },
    }

    await expect(
      syncMarketIndicator(
        { indicatorId: invalid.id, startDate: "2026-08-01" },
        {
          store: new MemoryStore([invalid]),
          providers: createProviderRegistry([marketProvider()]),
        }
      )
    ).rejects.toBeInstanceOf(ProviderConfigurationError)
  })

  it("returns a clear error when the active adapter is not registered", async () => {
    await expect(
      syncMarketIndicator(
        { indicatorId: MARKET_DXY.id, startDate: "2026-08-01" },
        {
          store: new MemoryStore(),
          providers: createProviderRegistry([]),
        }
      )
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError)
  })

  it("replaces old-provider observations after the active provider succeeds", async () => {
    const switched: IngestionIndicator = {
      ...MARKET_DXY,
      source: "mock_market_v2",
      metadata: {
        provider: "mock_market_v2",
        provider_symbol: "MOCK:DXY",
      },
    }
    const store = new MemoryStore([switched])
    store.seedObservation(switched.id, {
      observedAt: "2026-08-20T00:00:00.000Z",
      value: 102,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: null,
      buyVolume: null,
      metadata: {
        provider: "mock_market_v1",
        provider_symbol: "OLD:DXY",
        price_type: "close",
      },
    })
    const provider = marketProvider(
      [{ timestamp: "2026-08-21", close: 104 }],
      "mock_market_v2"
    )

    await syncMarketIndicator(
      { indicatorId: switched.id, startDate: "2026-08-21" },
      { store, providers: createProviderRegistry([provider]) }
    )

    expect(provider.requests).toHaveLength(1)
    expect(store.observations).toHaveLength(1)
    expect([...store.observations.values()][0]?.metadata.provider).toBe(
      "mock_market_v2"
    )
  })

  it("keeps old-provider observations when the new provider returns no data", async () => {
    const switched: IngestionIndicator = {
      ...MARKET_DXY,
      source: "mock_market_v2",
      metadata: {
        provider: "mock_market_v2",
        provider_symbol: "MOCK:DXY",
        sync_start_date: "2000-01-01",
      },
    }
    const store = new MemoryStore([switched])
    store.seedObservation(switched.id, {
      observedAt: "2026-08-20T00:00:00.000Z",
      value: 102,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: null,
      buyVolume: null,
      metadata: { provider: "mock_market_v1" },
    })

    await syncMarketIndicator(
      { indicatorId: switched.id },
      {
        store,
        providers: createProviderRegistry([
          marketProvider([], "mock_market_v2"),
        ]),
      }
    )

    expect(store.observations).toHaveLength(1)
    expect([...store.observations.values()][0]?.metadata.provider).toBe(
      "mock_market_v1"
    )
  })
})
