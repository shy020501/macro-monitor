import { describe, expect, it } from "vitest"

import {
  DEFAULT_FRED_INDICATOR_SYMBOLS,
  getFredSeriesMapping,
} from "@/lib/data-providers/fred/mappings"

describe("active FRED mappings", () => {
  it("resolves every configured macro indicator to an exact series", () => {
    expect(DEFAULT_FRED_INDICATOR_SYMBOLS).toHaveLength(15)

    for (const symbol of DEFAULT_FRED_INDICATOR_SYMBOLS) {
      const mapping = getFredSeriesMapping(symbol)
      expect(mapping?.indicatorSymbol).toBe(symbol)
      expect(mapping?.seriesId).toBeTruthy()
    }
  })
})
