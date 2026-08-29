export interface FredSeriesMapping {
  indicatorSymbol: string
  seriesId: string
  description: string
}

/**
 * Exact catalog mappings only. DXY and GOLD are intentionally absent because
 * the seeded concepts do not exactly match an unambiguous FRED series.
 */
export const FRED_SERIES_MAPPINGS: readonly FredSeriesMapping[] = [
  {
    indicatorSymbol: "US10Y",
    seriesId: "DGS10",
    description: "10-Year Treasury Constant Maturity Rate",
  },
  {
    indicatorSymbol: "US2Y",
    seriesId: "DGS2",
    description: "2-Year Treasury Constant Maturity Rate",
  },
  {
    indicatorSymbol: "SP500",
    seriesId: "SP500",
    description: "S&P 500 daily close",
  },
  {
    indicatorSymbol: "USDKRW",
    seriesId: "DEXKOUS",
    description: "South Korean Won to One U.S. Dollar",
  },
] as const

export function getFredSeriesMapping(
  indicatorSymbol: string
): FredSeriesMapping | undefined {
  const normalizedSymbol = indicatorSymbol.trim().toUpperCase()
  return FRED_SERIES_MAPPINGS.find(
    (mapping) => mapping.indicatorSymbol === normalizedSymbol
  )
}
