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
    indicatorSymbol: "CPI",
    seriesId: "CPIAUCSL",
    description: "Consumer Price Index for All Urban Consumers",
  },
  {
    indicatorSymbol: "CORE_CPI",
    seriesId: "CPILFESL",
    description: "Consumer Price Index Less Food and Energy",
  },
  {
    indicatorSymbol: "CORE_PCE",
    seriesId: "PCEPILFE",
    description: "Personal Consumption Expenditures Less Food and Energy",
  },
  {
    indicatorSymbol: "UNRATE",
    seriesId: "UNRATE",
    description: "Unemployment Rate",
  },
  {
    indicatorSymbol: "NFP",
    seriesId: "PAYEMS",
    description: "All Employees, Total Nonfarm",
  },
  {
    indicatorSymbol: "INITIAL_CLAIMS",
    seriesId: "ICSA",
    description: "Initial Unemployment Insurance Claims",
  },
  {
    indicatorSymbol: "REAL_GDP_GROWTH",
    seriesId: "A191RL1Q225SBEA",
    description: "Real GDP Percent Change from Preceding Period",
  },
  {
    indicatorSymbol: "INDPRO",
    seriesId: "INDPRO",
    description: "Industrial Production: Total Index",
  },
  {
    indicatorSymbol: "EFFR",
    seriesId: "EFFR",
    description: "Effective Federal Funds Rate",
  },
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
    indicatorSymbol: "US10Y2Y",
    seriesId: "T10Y2Y",
    description: "10-Year Treasury Minus 2-Year Treasury Spread",
  },
  {
    indicatorSymbol: "US10Y_REAL",
    seriesId: "DFII10",
    description: "10-Year Inflation-Indexed Treasury Yield",
  },
  {
    indicatorSymbol: "US10Y_BEI",
    seriesId: "T10YIE",
    description: "10-Year Breakeven Inflation Rate",
  },
  {
    indicatorSymbol: "NFCI",
    seriesId: "NFCI",
    description: "Chicago Fed National Financial Conditions Index",
  },
  {
    indicatorSymbol: "M2",
    seriesId: "M2SL",
    description: "M2 Money Stock",
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

/** Indicators whose active source is FRED in the current provider setup. */
export const DEFAULT_FRED_INDICATOR_SYMBOLS = [
  "CPI",
  "CORE_CPI",
  "CORE_PCE",
  "UNRATE",
  "NFP",
  "INITIAL_CLAIMS",
  "REAL_GDP_GROWTH",
  "INDPRO",
  "EFFR",
  "US2Y",
  "US10Y2Y",
  "US10Y_REAL",
  "US10Y_BEI",
  "NFCI",
  "M2",
] as const

export function getFredSeriesMapping(
  indicatorSymbol: string
): FredSeriesMapping | undefined {
  const normalizedSymbol = indicatorSymbol.trim().toUpperCase()
  return FRED_SERIES_MAPPINGS.find(
    (mapping) => mapping.indicatorSymbol === normalizedSymbol
  )
}
