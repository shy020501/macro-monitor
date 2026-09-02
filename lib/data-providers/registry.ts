import type {
  TimeSeriesInterval,
  TimeSeriesProvider,
  TimeSeriesProviderCapability,
  TimeSeriesProviderKind,
} from "@/lib/data-providers/types"
import type { IngestionIndicator } from "@/lib/ingestion/types"

export type TimeSeriesProviderRegistry = ReadonlyMap<
  string,
  TimeSeriesProvider
>

export interface ResolvedIndicatorProvider {
  provider: TimeSeriesProvider
  providerInstrumentId: string
}

export class DuplicateProviderError extends Error {
  constructor(providerId: string) {
    super(`Provider ${providerId} is registered more than once.`)
    this.name = "DuplicateProviderError"
  }
}

export class ProviderNotConfiguredError extends Error {
  constructor(providerId: string) {
    super(
      `Active provider ${providerId || "(empty)"} is not configured in the provider registry.`
    )
    this.name = "ProviderNotConfiguredError"
  }
}

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProviderConfigurationError"
  }
}

export class ProviderKindMismatchError extends Error {
  constructor(
    providerId: string,
    actual: TimeSeriesProviderKind,
    expected: TimeSeriesProviderKind
  ) {
    super(
      `Provider ${providerId} is a ${actual} provider and cannot be used for a ${expected} sync.`
    )
    this.name = "ProviderKindMismatchError"
  }
}

export class UnsupportedProviderCapabilityError extends Error {
  constructor(providerId: string, capability: TimeSeriesProviderCapability) {
    super(`Provider ${providerId} does not support ${capability} time series.`)
    this.name = "UnsupportedProviderCapabilityError"
  }
}

export class UnsupportedProviderInstrumentError extends Error {
  constructor(providerId: string, providerInstrumentId: string) {
    super(
      `Provider ${providerId} does not support instrument ${providerInstrumentId}.`
    )
    this.name = "UnsupportedProviderInstrumentError"
  }
}

export function createProviderRegistry(
  providers: readonly TimeSeriesProvider[]
): TimeSeriesProviderRegistry {
  const registry = new Map<string, TimeSeriesProvider>()

  for (const provider of providers) {
    const providerId = provider.id.trim()
    if (!providerId) {
      throw new ProviderConfigurationError("Provider id cannot be empty.")
    }
    if (registry.has(providerId)) throw new DuplicateProviderError(providerId)
    registry.set(providerId, provider)
  }

  return registry
}

function requiredCapability(
  interval: TimeSeriesInterval
): TimeSeriesProviderCapability {
  return interval === "1d" ? "daily" : "intraday"
}

export function resolveProviderForIndicator(
  indicator: IngestionIndicator,
  providers: TimeSeriesProviderRegistry,
  options: {
    expectedKind: TimeSeriesProviderKind
    interval: TimeSeriesInterval
  }
): ResolvedIndicatorProvider {
  const activeProviderId = indicator.source.trim()
  const metadataProvider = indicator.metadata.provider

  if (
    typeof metadataProvider !== "string" ||
    metadataProvider.trim() !== activeProviderId
  ) {
    throw new ProviderConfigurationError(
      `Indicator ${indicator.symbol} must have matching source and metadata.provider values.`
    )
  }

  const provider = providers.get(activeProviderId)
  if (!provider) throw new ProviderNotConfiguredError(activeProviderId)
  if (provider.kind !== options.expectedKind) {
    throw new ProviderKindMismatchError(
      provider.id,
      provider.kind,
      options.expectedKind
    )
  }

  const capability = requiredCapability(options.interval)
  if (!provider.capabilities.includes(capability)) {
    throw new UnsupportedProviderCapabilityError(provider.id, capability)
  }

  const rawInstrumentId = indicator.metadata[provider.instrumentMetadataKey]
  if (typeof rawInstrumentId !== "string" || !rawInstrumentId.trim()) {
    throw new ProviderConfigurationError(
      `Indicator ${indicator.symbol} requires metadata.${provider.instrumentMetadataKey} for provider ${provider.id}.`
    )
  }

  const providerInstrumentId = rawInstrumentId.trim()
  if (
    provider.supportsInstrument &&
    !provider.supportsInstrument(providerInstrumentId)
  ) {
    throw new UnsupportedProviderInstrumentError(
      provider.id,
      providerInstrumentId
    )
  }

  return { provider, providerInstrumentId }
}
