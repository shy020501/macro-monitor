import { describe, expect, it } from "vitest"

import { normalizeFredObservations } from "@/lib/data-providers/fred/normalize"

describe("normalizeFredObservations", () => {
  it("normalizes date-only values to midnight UTC and parses numbers", () => {
    const result = normalizeFredObservations(
      [{ date: "2026-08-24", value: "4.375" }],
      "DGS10"
    )

    expect(result).toEqual({
      observations: [
        {
          observedAt: "2026-08-24T00:00:00.000Z",
          value: 4.375,
          metadata: {
            provider: "fred",
            provider_series_id: "DGS10",
          },
        },
      ],
      fetchedCount: 1,
      skippedCount: 0,
    })
  })

  it("skips FRED missing values and invalid numeric values", () => {
    const result = normalizeFredObservations(
      [
        { date: "2026-08-22", value: "." },
        { date: "2026-08-23", value: "not-a-number" },
        { date: "2026-08-24", value: "4.5" },
      ],
      "DGS10"
    )

    expect(result.observations).toHaveLength(1)
    expect(result.fetchedCount).toBe(3)
    expect(result.skippedCount).toBe(2)
  })

  it("accepts an empty observations array", () => {
    expect(normalizeFredObservations([], "DGS10")).toEqual({
      observations: [],
      fetchedCount: 0,
      skippedCount: 0,
    })
  })

  it("skips impossible dates without local-time rollover", () => {
    const result = normalizeFredObservations(
      [{ date: "2026-02-30", value: "1" }],
      "DGS10"
    )

    expect(result.observations).toEqual([])
    expect(result.skippedCount).toBe(1)
  })
})
