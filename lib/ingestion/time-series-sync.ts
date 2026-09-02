import type {
  NormalizedObservation,
  TimeSeriesInterval,
  TimeSeriesProvider,
} from "@/lib/data-providers/types"
import type { JsonObject } from "@/lib/domain/indicators"
import type {
  IngestionIndicator,
  ObservationIngestionStore,
  ObservationSyncResult,
  StoredObservationRecord,
} from "@/lib/ingestion/types"

export class IndicatorNotFoundError extends Error {
  constructor(indicatorId: string) {
    super(`Indicator ${indicatorId} was not found.`)
    this.name = "IndicatorNotFoundError"
  }
}

export class InvalidSyncRangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidSyncRangeError"
  }
}

export class ActiveProviderMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ActiveProviderMismatchError"
  }
}

export class ProviderContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProviderContractError"
  }
}

export interface SyncTimeSeriesIndicatorInput {
  indicator: IngestionIndicator
  provider: TimeSeriesProvider
  providerInstrumentId: string
  startDate?: string
  endDate?: string
  interval?: TimeSeriesInterval
  /** Existing FRED onboarding path from the local mock catalog only. */
  allowSeedSourceTransition?: boolean
  /** Allows replacing seed observations after an active provider is selected. */
  allowSeedObservationTransition?: boolean
  /** Replaces observations from a previous provider after a live batch succeeds. */
  allowProviderObservationTransition?: boolean
  provenance?: JsonObject
}

function parseDateOnly(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidSyncRangeError(`${field} must use YYYY-MM-DD format.`)
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new InvalidSyncRangeError(`${field} is not a valid calendar date.`)
  }
  return parsed
}

function toUtcDateOnly(timestamp: string): string {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    throw new InvalidSyncRangeError(
      `Latest observation timestamp is invalid: ${timestamp}`
    )
  }
  return parsed.toISOString().slice(0, 10)
}

function nextUtcDate(dateOnly: string): string {
  const date = parseDateOnly(dateOnly, "latest observation date")
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function isSeedProvider(value: unknown): boolean {
  return value === "seed" || value === "mock"
}

function assertActiveBinding(input: SyncTimeSeriesIndicatorInput): void {
  const { indicator, provider, providerInstrumentId } = input
  const metadataProvider = indicator.metadata.provider
  const activeBindingMatches =
    indicator.source === provider.id &&
    (metadataProvider === undefined || metadataProvider === provider.id)

  const seedTransition =
    input.allowSeedSourceTransition === true &&
    indicator.source === "mock" &&
    (metadataProvider === undefined || isSeedProvider(metadataProvider))

  if (!activeBindingMatches && !seedTransition) {
    throw new ActiveProviderMismatchError(
      `Indicator ${indicator.symbol} has active source ${indicator.source}; provider ${provider.id} cannot write to it.`
    )
  }

  if (activeBindingMatches) {
    const configuredInstrument =
      indicator.metadata[provider.instrumentMetadataKey]
    if (
      typeof configuredInstrument === "string" &&
      configuredInstrument.trim() &&
      configuredInstrument.trim() !== providerInstrumentId
    ) {
      throw new ActiveProviderMismatchError(
        `Indicator ${indicator.symbol} is bound to ${configuredInstrument}, not ${providerInstrumentId}.`
      )
    }
  }
}

async function getLatestObservedAt(
  store: ObservationIngestionStore,
  input: SyncTimeSeriesIndicatorInput
): Promise<string | null> {
  const latestObservedAt = await store.getLatestObservedAt(input.indicator.id)
  if (!latestObservedAt) return null

  const [latest] = await store.getExistingObservations(input.indicator.id, [
    latestObservedAt,
  ])
  const storedProvider = latest?.metadata.provider
  const compatibleSeed =
    isSeedProvider(storedProvider) &&
    (input.allowSeedSourceTransition === true ||
      input.allowSeedObservationTransition === true)
  const compatibleProviderTransition =
    input.allowProviderObservationTransition === true

  if (
    storedProvider !== input.provider.id &&
    !compatibleSeed &&
    !compatibleProviderTransition
  ) {
    throw new ActiveProviderMismatchError(
      `Indicator ${input.indicator.symbol} already contains observations from ${String(storedProvider ?? "an unknown provider")}; refusing to mix them with ${input.provider.id}.`
    )
  }

  return latestObservedAt
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index]))
    )
  }
  if (
    left &&
    right &&
    typeof left === "object" &&
    typeof right === "object" &&
    !Array.isArray(left) &&
    !Array.isArray(right)
  ) {
    const leftRecord = left as Record<string, unknown>
    const rightRecord = right as Record<string, unknown>
    const leftKeys = Object.keys(leftRecord).sort()
    const rightKeys = Object.keys(rightRecord).sort()
    return (
      deepEqual(leftKeys, rightKeys) &&
      leftKeys.every((key) => deepEqual(leftRecord[key], rightRecord[key]))
    )
  }
  return false
}

function existingMatchesPoint(
  existing: StoredObservationRecord | undefined,
  incoming: NormalizedObservation
): boolean {
  const open = incoming.open ?? null
  const high = incoming.high ?? null
  const low = incoming.low ?? null
  const close = incoming.close ?? null
  const volume = incoming.volume ?? null
  const buyVolume = incoming.buyVolume ?? null

  return Boolean(
    existing &&
      existing.value === incoming.value &&
      existing.open === open &&
      existing.high === high &&
      existing.low === low &&
      existing.close === close &&
      existing.volume === volume &&
      existing.buyVolume === buyVolume &&
      deepEqual(existing.metadata, incoming.metadata)
  )
}

function validateNormalizedObservations(
  observations: NormalizedObservation[]
): NormalizedObservation[] {
  const seen = new Set<string>()

  return observations.map((observation, index) => {
    const parsedTimestamp = new Date(observation.observedAt)
    if (Number.isNaN(parsedTimestamp.getTime())) {
      throw new ProviderContractError(
        `Provider returned an invalid normalized timestamp at index ${index}.`
      )
    }
    if (!Number.isFinite(observation.value)) {
      throw new ProviderContractError(
        `Provider returned an invalid normalized value at index ${index}.`
      )
    }


    const ohlc = [
      observation.open,
      observation.high,
      observation.low,
      observation.close,
    ]
    const populatedOhlc = ohlc.filter((value) => value !== undefined)
    if (populatedOhlc.length !== 0 && populatedOhlc.length !== 4) {
      throw new ProviderContractError(
        `Provider returned partial OHLC values at index ${index}.`
      )
    }
    if (
      populatedOhlc.some(
        (value) => typeof value !== "number" || !Number.isFinite(value)
      )
    ) {
      throw new ProviderContractError(
        `Provider returned invalid OHLC values at index ${index}.`
      )
    }
    if (
      populatedOhlc.length === 4 &&
      (observation.close !== observation.value ||
        observation.high! < Math.max(observation.open!, observation.close!) ||
        observation.low! > Math.min(observation.open!, observation.close!) ||
        observation.high! < observation.low!)
    ) {
      throw new ProviderContractError(
        `Provider returned inconsistent OHLC values at index ${index}.`
      )
    }
    for (const [field, value] of [
      ["volume", observation.volume],
      ["buyVolume", observation.buyVolume],
    ] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new ProviderContractError(
          `Provider returned invalid ${field} at index ${index}.`
        )
      }
    }

    const observedAt = parsedTimestamp.toISOString()
    if (seen.has(observedAt)) {
      throw new ProviderContractError(
        `Provider returned duplicate normalized timestamp ${observedAt}.`
      )
    }
    seen.add(observedAt)
    return { ...observation, observedAt }
  })
}

function providerBindingIsCurrent(
  input: SyncTimeSeriesIndicatorInput
): boolean {
  return (
    input.indicator.source === input.provider.id &&
    input.indicator.metadata.provider === input.provider.id &&
    input.indicator.metadata[input.provider.instrumentMetadataKey] ===
      input.providerInstrumentId
  )
}

export async function syncTimeSeriesIndicator(
  input: SyncTimeSeriesIndicatorInput,
  store: ObservationIngestionStore
): Promise<ObservationSyncResult> {
  if (input.endDate) parseDateOnly(input.endDate, "endDate")
  assertActiveBinding(input)

  const latestObservedAt = await getLatestObservedAt(store, input)
  const latestObservation = latestObservedAt
    ? (
        await store.getExistingObservations(input.indicator.id, [
          latestObservedAt,
        ])
      )[0]
    : undefined
  const seedTransition =
    latestObservation?.metadata.provider !== input.provider.id &&
    (input.allowProviderObservationTransition === true ||
      (isSeedProvider(latestObservation?.metadata.provider) &&
        (input.allowSeedSourceTransition === true ||
          input.allowSeedObservationTransition === true)))
  let from: string
  if (input.startDate) {
    parseDateOnly(input.startDate, "startDate")
    from = input.startDate
  } else if (latestObservedAt && !seedTransition) {
    from = nextUtcDate(toUtcDateOnly(latestObservedAt))
  } else {
    const configuredStartDate = input.indicator.metadata.sync_start_date
    if (typeof configuredStartDate !== "string") {
      throw new InvalidSyncRangeError(
        "startDate is required for the first sync when no observations exist."
      )
    }
    parseDateOnly(configuredStartDate, "metadata.sync_start_date")
    from = configuredStartDate
  }

  if (
    input.endDate &&
    parseDateOnly(from, "startDate") > parseDateOnly(input.endDate, "endDate")
  ) {
    return {
      indicator: input.indicator.symbol,
      indicatorId: input.indicator.id,
      provider: input.provider.id,
      providerInstrumentId: input.providerInstrumentId,
      fetched: 0,
      valid: 0,
      upserted: 0,
      skipped: 0,
      from,
      to: input.endDate,
    }
  }

  const batch = await input.provider.fetchObservations({
    providerInstrumentId: input.providerInstrumentId,
    startDate: from,
    endDate: input.endDate,
    interval: input.interval ?? "1d",
  })
  const normalized = validateNormalizedObservations(batch.observations).map(
    (observation) => ({
      ...observation,
      metadata: {
        ...observation.metadata,
        ...input.provenance,
        provider: input.provider.id,
        [input.provider.instrumentMetadataKey]: input.providerInstrumentId,
      },
    })
  )
  const existingRows = await store.getExistingObservations(
    input.indicator.id,
    normalized.map((observation) => observation.observedAt)
  )
  const existingByTimestamp = new Map(
    existingRows.map((observation) => [observation.observedAt, observation])
  )
  const changed = normalized.filter(
    (observation) =>
      !existingMatchesPoint(
        existingByTimestamp.get(observation.observedAt),
        observation
      )
  )

  await store.upsertObservations(
    input.indicator.id,
    changed.map((observation) => ({
      observedAt: observation.observedAt,
      value: observation.value,
      open: observation.open ?? null,
      high: observation.high ?? null,
      low: observation.low ?? null,
      close: observation.close ?? null,
      volume: observation.volume ?? null,
      buyVolume: observation.buyVolume ?? null,
      metadata: observation.metadata,
    }))
  )

  if (normalized.length > 0 && input.allowProviderObservationTransition) {
    await store.deleteObservationsExceptProvider(
      input.indicator.id,
      input.provider.id
    )
  } else if (
    normalized.length > 0 &&
    (input.allowSeedSourceTransition || input.allowSeedObservationTransition)
  ) {
    await store.deleteObservationsExceptProvider(
      input.indicator.id,
      input.provider.id
    )
  }

  if (normalized.length > 0 && !providerBindingIsCurrent(input)) {
    await store.updateIndicatorProvider(input.indicator, input.provider.id, {
      provider: input.provider.id,
      [input.provider.instrumentMetadataKey]: input.providerInstrumentId,
    })
  }

  return {
    indicator: input.indicator.symbol,
    indicatorId: input.indicator.id,
    provider: input.provider.id,
    providerInstrumentId: input.providerInstrumentId,
    fetched: batch.fetchedCount,
    valid: normalized.length,
    upserted: changed.length,
    skipped: batch.skippedCount + (normalized.length - changed.length),
    from,
    to: input.endDate ?? null,
  }
}
