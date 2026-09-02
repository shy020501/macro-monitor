import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"

import { assertDailyInterval } from "@/lib/data-providers/market/daily-only"
import { normalizeMarketObservations } from "@/lib/data-providers/market/normalize"
import type { MarketObservationCandidate } from "@/lib/data-providers/market/types"
import type {
  FetchObservationsInput,
  ObservationBatch,
  TimeSeriesProvider,
} from "@/lib/data-providers/types"

const execFileAsync = promisify(execFile)

export const YAHOO_FINANCE_DAILY_SYMBOLS = [
  "DX-Y.NYB",
  "^TNX",
  "^FVX",
  "^TYX",
  "^IRX",
  "^GSPC",
  "^IXIC",
  "^VIX",
  "^KS11",
  "^KQ11",
  "CL=F",
  "HG=F",
  "GC=F",
  "KRW=X",
  "JPY=X",
] as const

interface YFinanceBridgeResponse {
  rows: MarketObservationCandidate[]
}

export interface YFinanceBridgeInput {
  symbol: string
  startDate: string
  endDate?: string
  interval: "1d"
}

export type YFinanceBridgeRunner = (
  input: YFinanceBridgeInput
) => Promise<YFinanceBridgeResponse>

export class YFinanceRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "YFinanceRuntimeError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseYFinanceBridgeOutput(
  output: string
): YFinanceBridgeResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(output)
  } catch {
    throw new YFinanceRuntimeError(
      "The yfinance bridge returned invalid JSON output."
    )
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.rows)) {
    throw new YFinanceRuntimeError(
      "The yfinance bridge response is missing its rows array."
    )
  }

  return { rows: parsed.rows as MarketObservationCandidate[] }
}

export function createPythonYFinanceBridgeRunner(options?: {
  pythonExecutable?: string
  scriptPath?: string
  cwd?: string
  timeoutMs?: number
}): YFinanceBridgeRunner {
  const cwd = options?.cwd ?? process.cwd()
  const pythonExecutable = options?.pythonExecutable?.trim() || "python"
  const scriptPath =
    options?.scriptPath ??
    path.join(cwd, "scripts", "providers", "yfinance_bridge.py")

  return async (input) => {
    const args = [
      scriptPath,
      "--symbol",
      input.symbol,
      "--start",
      input.startDate,
      "--interval",
      input.interval,
    ]
    if (input.endDate) args.push("--end", input.endDate)

    try {
      const result = await execFileAsync(pythonExecutable, args, {
        cwd,
        windowsHide: true,
        timeout: options?.timeoutMs ?? 60_000,
        maxBuffer: 10 * 1024 * 1024,
        encoding: "utf8",
      })
      return parseYFinanceBridgeOutput(result.stdout)
    } catch (error) {
      if (error instanceof YFinanceRuntimeError) throw error
      const stderr =
        isRecord(error) && typeof error.stderr === "string"
          ? error.stderr.trim()
          : ""
      const detail = stderr ? ` ${stderr}` : ""
      throw new YFinanceRuntimeError(
        `yfinance could not fetch market data.${detail} Run \"pnpm setup:market\" and verify Python is available.`
      )
    }
  }
}

export class YahooFinanceProvider implements TimeSeriesProvider {
  readonly id = "yahoo_finance"
  readonly kind = "market" as const
  readonly instrumentMetadataKey = "provider_symbol"
  readonly capabilities = [
    "daily",
    "fx",
    "index",
    "commodity",
    "ohlc",
  ] as const

  private readonly supportedSymbols = new Set<string>(
    YAHOO_FINANCE_DAILY_SYMBOLS
  )

  constructor(private readonly runBridge: YFinanceBridgeRunner) {}

  supportsInstrument(providerInstrumentId: string): boolean {
    return this.supportedSymbols.has(providerInstrumentId)
  }

  async fetchObservations(
    input: FetchObservationsInput
  ): Promise<ObservationBatch> {
    assertDailyInterval(this.id, input.interval)
    const response = await this.runBridge({
      symbol: input.providerInstrumentId,
      startDate: input.startDate,
      endDate: input.endDate,
      interval: "1d",
    })

    return normalizeMarketObservations(response.rows, {
      providerId: this.id,
      providerSymbol: input.providerInstrumentId,
      priceType: "close",
    })
  }
}
