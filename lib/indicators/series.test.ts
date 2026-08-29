import { describe, expect, it } from "vitest"

import { calculateMovingAverageSeries } from "@/lib/indicators/series"

describe("calculateMovingAverageSeries", () => {
  it("aligns complete rolling windows with the source series", () => {
    expect(calculateMovingAverageSeries([1, 2, 3, 4, 5], 3)).toEqual([
      null,
      null,
      2,
      3,
      4,
    ])
  })

  it("returns null when there are not enough observations", () => {
    expect(calculateMovingAverageSeries([10, 20], 5)).toEqual([null, null])
  })

  it("rejects an invalid window", () => {
    expect(() => calculateMovingAverageSeries([1, 2], 0)).toThrow(
      "positive integer"
    )
  })
})
