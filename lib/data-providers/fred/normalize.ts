import type { ObservationBatch } from "@/lib/data-providers/types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeFredDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return null
  }

  return parsed.toISOString()
}

function normalizeFredNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null

  const text = String(value).trim()
  if (text === "" || text === ".") return null

  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Converts FRED date-only rows to midnight UTC point observations. Missing
 * values ("."), invalid numbers, malformed dates, and duplicate dates are
 * skipped rather than synthesized or interpolated.
 */
export function normalizeFredObservations(
  rows: unknown[],
  seriesId: string
): ObservationBatch {
  const byTimestamp = new Map<
    string,
    ObservationBatch["observations"][number]
  >()

  for (const row of rows) {
    if (!isRecord(row)) continue

    const observedAt = normalizeFredDate(row.date)
    const value = normalizeFredNumber(row.value)
    if (observedAt === null || value === null) continue

    byTimestamp.set(observedAt, {
      observedAt,
      value,
      metadata: {
        provider: "fred",
        provider_series_id: seriesId,
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
