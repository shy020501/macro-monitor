import type { TimeSeriesInterval } from "@/lib/data-providers/types"

export class DailyMarketProviderOnlyError extends Error {
  constructor(providerId: string, interval: TimeSeriesInterval) {
    super(`${providerId} currently supports only the daily interval (1d), not ${interval}.`)
    this.name = "DailyMarketProviderOnlyError"
  }
}

export function assertDailyInterval(
  providerId: string,
  interval: TimeSeriesInterval | undefined
): void {
  if (interval !== undefined && interval !== "1d") {
    throw new DailyMarketProviderOnlyError(providerId, interval)
  }
}
