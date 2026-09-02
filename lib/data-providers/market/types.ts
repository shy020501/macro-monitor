import type { JsonObject } from "@/lib/domain/indicators"

/**
 * Provider adapters extract their response into this small boundary before
 * common validation. Timestamps must be date-only or timezone-qualified ISO.
 */
export interface MarketObservationCandidate {
  timestamp: unknown
  open?: unknown
  high?: unknown
  low?: unknown
  close: unknown
  volume?: unknown
  buyVolume?: unknown
  metadata?: JsonObject
}

export interface MarketNormalizationContext {
  providerId: string
  providerSymbol: string
  priceType?: "close"
}
