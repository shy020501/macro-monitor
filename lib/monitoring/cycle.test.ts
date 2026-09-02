import { describe, expect, it } from "vitest"

import type { ConditionTree } from "@/lib/domain/conditions"
import type { Observation } from "@/lib/domain/indicators"
import type {
  IngestionIndicator,
  ObservationSyncResult,
} from "@/lib/ingestion/types"
import { runMonitoringCycle } from "@/lib/monitoring/cycle"
import type {
  ConditionTransitionResult,
  MonitoringDependencies,
  MonitoringStore,
  ProcessConditionEvaluationInput,
} from "@/lib/monitoring/types"

const conditionId = "10000000-0000-4000-8000-000000000001"
const groupId = "20000000-0000-4000-8000-000000000001"
const ruleId = "30000000-0000-4000-8000-000000000001"
const indicatorId = "40000000-0000-4000-8000-000000000001"

function thresholdCondition(threshold: number): ConditionTree {
  return {
    id: conditionId,
    name: "Threshold condition",
    description: "",
    enabled: true,
    root: {
      kind: "group",
      id: groupId,
      operator: "and",
      children: [
        {
          kind: "rule",
          id: ruleId,
          indicatorId,
          indicatorSymbol: "TEST",
          enabled: true,
          ruleType: "threshold",
          operator: "gt",
          parameters: { value: threshold },
        },
      ],
    },
  }
}

function percentageCondition(): ConditionTree {
  const condition = thresholdCondition(0)
  condition.root.children = [
    {
      kind: "rule",
      id: ruleId,
      indicatorId,
      indicatorSymbol: "TEST",
      enabled: true,
      ruleType: "percentage_change",
      operator: "gt",
      parameters: { threshold: 1, window: 2, window_unit: "period" },
    },
  ]
  return condition
}

function observation(value: number, day = 1): Observation {
  return {
    id: `50000000-0000-4000-8000-${String(day).padStart(12, "0")}`,
    indicatorId,
    observedAt: `2026-09-${String(day).padStart(2, "0")}T00:00:00.000Z`,
    value,
    open: null,
    high: null,
    low: null,
    close: null,
    volume: null,
    buyVolume: null,
    metadata: { provider: "test" },
  }
}

const syncIndicator: IngestionIndicator = {
  id: indicatorId,
  symbol: "TEST",
  source: "test_provider",
  metadata: { provider: "test_provider" },
}

class MemoryMonitoringStore implements MonitoringStore {
  conditions: ConditionTree[] = []
  observations: Observation[] = []
  syncIndicators: IngestionIndicator[] = []
  readonly states = new Map<string, boolean | null>()
  readonly alerts: ProcessConditionEvaluationInput[] = []
  readonly errors: ProcessConditionEvaluationInput[] = []
  private queue: Promise<void> = Promise.resolve()

  listSyncIndicators(): Promise<IngestionIndicator[]> {
    return Promise.resolve(this.syncIndicators)
  }

  listEnabledConditions(): Promise<ConditionTree[]> {
    return Promise.resolve(this.conditions.filter((condition) => condition.enabled))
  }

  loadIndicatorObservations(
    _requestedIndicatorId: string,
    limit: number
  ): Promise<Observation[]> {
    return Promise.resolve(this.observations.slice(-limit))
  }

  processConditionEvaluation(
    input: ProcessConditionEvaluationInput
  ): Promise<ConditionTransitionResult> {
    const operation = this.queue.then(() => {
      const previous = this.states.get(input.conditionId) ?? null
      if (input.error) {
        this.errors.push(input)
        return {
          alertCreated: false,
          alertId: null,
          previousMatched: previous,
          currentMatched: previous,
        }
      }

      const matched = input.matched ?? false
      const alertCreated = matched && previous !== true
      const alertId = alertCreated ? crypto.randomUUID() : null
      if (alertCreated) this.alerts.push(input)
      this.states.set(input.conditionId, matched)
      return {
        alertCreated,
        alertId,
        previousMatched: previous,
        currentMatched: matched,
      }
    })
    this.queue = operation.then(
      () => undefined,
      () => undefined
    )
    return operation
  }
}

function dependencies(
  store: MemoryMonitoringStore,
  sync: MonitoringDependencies["syncIndicator"] = async (
    indicator
  ): Promise<ObservationSyncResult> => ({
    indicator: indicator.symbol,
    indicatorId: indicator.id,
    provider: indicator.source,
    providerInstrumentId: "TEST",
    fetched: 0,
    valid: 0,
    upserted: 0,
    skipped: 0,
    from: "2026-09-01",
    to: null,
  })
): MonitoringDependencies {
  return {
    store,
    syncIndicator: sync,
    now: () => new Date("2026-09-02T12:00:00.000Z"),
  }
}

describe("runMonitoringCycle transitions", () => {
  it("does not alert when the first successful evaluation is false", async () => {
    const store = new MemoryMonitoringStore()
    store.conditions = [thresholdCondition(10)]
    store.observations = [observation(5)]

    const result = await runMonitoringCycle(
      { skipSync: true },
      dependencies(store)
    )

    expect(result.alertsCreated).toBe(0)
    expect(store.states.get(conditionId)).toBe(false)
  })

  it("alerts once when the first successful evaluation is true", async () => {
    const store = new MemoryMonitoringStore()
    store.conditions = [thresholdCondition(10)]
    store.observations = [observation(15)]

    const result = await runMonitoringCycle(
      { skipSync: true },
      dependencies(store)
    )

    expect(result.alertsCreated).toBe(1)
    expect(store.alerts).toHaveLength(1)
    expect(store.alerts[0]?.payload).toMatchObject({
      condition_name: "Threshold condition",
      triggered_by: "monitor",
    })
  })

  it("alerts only on false-to-true transitions and can alert after reset", async () => {
    const store = new MemoryMonitoringStore()
    store.conditions = [thresholdCondition(10)]
    const run = () =>
      runMonitoringCycle({ skipSync: true }, dependencies(store))

    store.observations = [observation(5)]
    await run()
    store.observations = [observation(15)]
    expect((await run()).alertsCreated).toBe(1)
    expect((await run()).alertsCreated).toBe(0)
    store.observations = [observation(5)]
    expect((await run()).alertsCreated).toBe(0)
    expect(store.states.get(conditionId)).toBe(false)
    store.observations = [observation(15)]
    expect((await run()).alertsCreated).toBe(1)
    expect(store.alerts).toHaveLength(2)
  })

  it("preserves lastMatched when evaluation data is insufficient", async () => {
    const store = new MemoryMonitoringStore()
    store.conditions = [percentageCondition()]
    store.observations = [observation(10)]
    store.states.set(conditionId, true)

    const result = await runMonitoringCycle(
      { skipSync: true },
      dependencies(store)
    )

    expect(result.conditions.failed).toBe(1)
    expect(result.alertsCreated).toBe(0)
    expect(store.states.get(conditionId)).toBe(true)
    expect(store.errors).toHaveLength(1)
  })

  it("skips a condition after a required indicator sync failure", async () => {
    const store = new MemoryMonitoringStore()
    store.conditions = [thresholdCondition(10)]
    store.observations = [observation(15)]
    store.syncIndicators = [syncIndicator]
    store.states.set(conditionId, true)

    const result = await runMonitoringCycle(
      {},
      dependencies(store, async () => {
        throw new Error("provider unavailable")
      })
    )

    expect(result.sync.failed).toBe(1)
    expect(result.conditions.skipped).toBe(1)
    expect(result.alertsCreated).toBe(0)
    expect(store.states.get(conditionId)).toBe(true)
  })

  it("creates only one alert when two cycles race on the same transition", async () => {
    const store = new MemoryMonitoringStore()
    store.conditions = [thresholdCondition(10)]
    store.observations = [observation(15)]

    const [first, second] = await Promise.all([
      runMonitoringCycle({ skipSync: true }, dependencies(store)),
      runMonitoringCycle({ skipSync: true }, dependencies(store)),
    ])

    expect(first.alertsCreated + second.alertsCreated).toBe(1)
    expect(store.alerts).toHaveLength(1)
  })
})
