import { describe, expect, it } from "vitest"

import { MockMarketProvider } from "@/lib/data-providers/market/mock-provider"
import { UnsupportedProviderInstrumentError } from "@/lib/data-providers/registry"

describe("MockMarketProvider", () => {
  it("surfaces a configured provider error", async () => {
    const provider = new MockMarketProvider({
      responses: { "MOCK:DXY": [] },
      error: new Error("provider unavailable"),
    })

    await expect(
      provider.fetchObservations({
        providerInstrumentId: "MOCK:DXY",
        startDate: "2026-08-01",
      })
    ).rejects.toThrow("provider unavailable")
  })

  it("returns an explicit unsupported-instrument error", async () => {
    const provider = new MockMarketProvider({ responses: {} })

    await expect(
      provider.fetchObservations({
        providerInstrumentId: "MOCK:UNKNOWN",
        startDate: "2026-08-01",
      })
    ).rejects.toBeInstanceOf(UnsupportedProviderInstrumentError)
  })
})
