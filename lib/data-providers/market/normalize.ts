import type { ObservationBatch } from "@/lib/data-providers/types"
import type {
  MarketNormalizationContext,
  MarketObservationCandidate,
} from "@/lib/data-providers/market/types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeMarketTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parsed = new Date(`${text}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === text
      ? parsed.toISOString()
      : null
  }

  // Reject local/ambiguous date-times. Provider adapters must retain a zone.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) return null
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizeMarketNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const text = String(value).trim()
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeOptionalMarketNumber(
  value: unknown
): number | null | undefined {
  if (value === undefined || value === null || value === "") return undefined
  return normalizeMarketNumber(value)
}

/**
 * Normalizes provider-extracted market rows without assuming any production
 * provider response shape or ticker convention. Duplicate timestamps use the
 * last valid row, matching an upsert/correction workflow.
 */
export function normalizeMarketObservations(
  rows: unknown[],
  context: MarketNormalizationContext
): ObservationBatch {
  const byTimestamp = new Map<
    string,
    ObservationBatch["observations"][number]
  >()

  for (const input of rows) {
    if (!isRecord(input)) continue
    const row = input as unknown as MarketObservationCandidate
    const observedAt = normalizeMarketTimestamp(row.timestamp)
    const value = normalizeMarketNumber(row.close)
    if (observedAt === null || value === null) continue

    const open = normalizeOptionalMarketNumber(row.open)
    const high = normalizeOptionalMarketNumber(row.high)
    const low = normalizeOptionalMarketNumber(row.low)
    const volume = normalizeOptionalMarketNumber(row.volume)
    const buyVolume = normalizeOptionalMarketNumber(row.buyVolume)
    const suppliedOhlc = [open, high, low].some(
      (field) => field !== undefined
    )
    const validOhlc =
      open !== null &&
      open !== undefined &&
      high !== null &&
      high !== undefined &&
      low !== null &&
      low !== undefined &&
      high >= Math.max(open, value) &&
      low <= Math.min(open, value) &&
      high >= low

    if (suppliedOhlc && !validOhlc) continue
    if (volume === null || buyVolume === null) continue
    if ((volume !== undefined && volume < 0) || (buyVolume !== undefined && buyVolume < 0)) {
      continue
    }

    byTimestamp.set(observedAt, {
      observedAt,
      value,
      ...(validOhlc
        ? { open, high, low, close: value }
        : {}),
      ...(volume === undefined ? {} : { volume }),
      ...(buyVolume === undefined ? {} : { buyVolume }),
      metadata: {
        ...(isRecord(row.metadata) ? row.metadata : {}),
        provider: context.providerId,
        provider_symbol: context.providerSymbol,
        price_type: context.priceType ?? "close",
      },
    })
  }

  const observations = [...byTimestamp.values()].sort((left, right) =>
    left.observedAt.localeCompare(right.observedAt)
  )

  return {
    observations,
    fetchedCount: rows.length,
    skippedCount: rows.length - observations.length,
  }
}
