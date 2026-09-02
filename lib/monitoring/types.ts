import type { ConditionTree } from "@/lib/domain/conditions"
import type {
  JsonObject,
  Observation,
  ObservationsByIndicator,
} from "@/lib/domain/indicators"
import type {
  IngestionIndicator,
  ObservationSyncResult,
} from "@/lib/ingestion/types"

export interface ProcessConditionEvaluationInput {
  conditionId: string
  matched: boolean | null
  evaluatedAt: string
  error?: string
  message?: string
  payload?: JsonObject
}

export interface ConditionTransitionResult {
  alertCreated: boolean
  alertId: string | null
  previousMatched: boolean | null
  currentMatched: boolean | null
}

export interface MonitoringStore {
  listSyncIndicators(): Promise<IngestionIndicator[]>
  listEnabledConditions(): Promise<ConditionTree[]>
  loadIndicatorObservations(
    indicatorId: string,
    limit: number
  ): Promise<Observation[]>
  processConditionEvaluation(
    input: ProcessConditionEvaluationInput
  ): Promise<ConditionTransitionResult>
}

export interface MonitoringDependencies {
  store: MonitoringStore
  syncIndicator(indicator: IngestionIndicator): Promise<ObservationSyncResult>
  now?: () => Date
  formatError?: (error: unknown) => string
}

export interface MonitoringCycleOptions {
  skipSync?: boolean
  dryRun?: boolean
}

export interface IndicatorMonitoringResult {
  indicatorId: string
  indicator: string
  provider: string
  status: "succeeded" | "failed"
  fetched?: number
  upserted?: number
  error?: string
}

export interface ConditionMonitoringResult {
  conditionId: string
  conditionName: string
  status: "triggered" | "true" | "false" | "skipped" | "error"
  matched?: boolean
  alertCreated: boolean
  alertId?: string | null
  previousMatched?: boolean | null
  error?: string
}

export interface MonitoringCycleResult {
  startedAt: string
  completedAt: string
  dryRun: boolean
  sync: {
    skipped: boolean
    total: number
    succeeded: number
    failed: number
    results: IndicatorMonitoringResult[]
  }
  conditions: {
    total: number
    evaluated: number
    matched: number
    triggered: number
    skipped: number
    failed: number
    results: ConditionMonitoringResult[]
    errors: Array<{
      conditionId: string
      conditionName: string
      message: string
    }>
  }
  alertsCreated: number
}

export interface AlertSnapshotInput {
  condition: ConditionTree
  evaluation: {
    matched: boolean
    description: string
    evaluatedAt: string
    root?: unknown
  }
  observations: ObservationsByIndicator
}
