export function formatNumber(value: number | null, maximumFractionDigits = 2) {
  if (value === null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value)
}

export function formatSigned(value: number | null, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${formatNumber(value)}${suffix}`
}

export function formatTimestamp(value: string | null) {
  if (!value) return "No observations"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))
}
