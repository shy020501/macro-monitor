import type { ConditionTree } from "@/lib/domain/conditions"
import type { ObservationsByIndicator } from "@/lib/domain/indicators"
import { createAlertPayload } from "@/lib/monitoring/alert-snapshot"
import type {
  ConditionMonitoringResult,
  MonitoringCycleOptions,
  MonitoringCycleResult,
  MonitoringDependencies,
} from "@/lib/monitoring/types"
import {
  evaluateCondition,
  type GroupEvaluation,
  type RuleEvaluation,
} from "@/lib/rules/engine"
import {
  getConditionIndicatorIds,
  getObservationRequirements,
} from "@/lib/rules/observation-requirements"

function defaultFormatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown monitoring error"
}

function collectEvaluationErrors(
  node: GroupEvaluation | RuleEvaluation,
  errors: string[]
): void {
  if (node.kind === "group") {
    node.children.forEach((child) => collectEvaluationErrors(child, errors))
  } else if (!node.skipped && node.reason) {
    errors.push(`${node.description}: ${node.reason}`)
  }
}

function referencedFailures(
  condition: ConditionTree,
  failures: ReadonlyMap<string, string>
): string[] {
  return getConditionIndicatorIds(condition)
    .map((indicatorId) => failures.get(indicatorId))
    .filter((message): message is string => Boolean(message))
}

async function persistConditionError(
  condition: ConditionTree,
  message: string,
  evaluatedAt: string,
  options: MonitoringCycleOptions,
  dependencies: MonitoringDependencies
): Promise<string> {
  if (options.dryRun) return message

  try {
    await dependencies.store.processConditionEvaluation({
      conditionId: condition.id,
      matched: null,
      evaluatedAt,
      error: message,
    })
    return message
  } catch (error) {
    const formatError = dependencies.formatError ?? defaultFormatError
    return `${message} Runtime error persistence also failed: ${formatError(error)}`
  }
}

export async function runMonitoringCycle(
  options: MonitoringCycleOptions,
  dependencies: MonitoringDependencies
): Promise<MonitoringCycleResult> {
  const now = dependencies.now ?? (() => new Date())
  const formatError = dependencies.formatError ?? defaultFormatError
  const startedAt = now().toISOString()
  const syncResults: MonitoringCycleResult["sync"]["results"] = []
  const syncFailures = new Map<string, string>()

  if (!options.skipSync) {
    const indicators = await dependencies.store.listSyncIndicators()
    for (const indicator of indicators) {
      try {
        const result = await dependencies.syncIndicator(indicator)
        syncResults.push({
          indicatorId: indicator.id,
          indicator: indicator.symbol,
          provider: result.provider,
          status: "succeeded",
          fetched: result.fetched,
          upserted: result.upserted,
        })
      } catch (error) {
        const message = formatError(error)
        syncFailures.set(indicator.id, `${indicator.symbol}: ${message}`)
        syncResults.push({
          indicatorId: indicator.id,
          indicator: indicator.symbol,
          provider: indicator.source,
          status: "failed",
          error: message,
        })
      }
    }
  }

  const conditions = await dependencies.store.listEnabledConditions()
  const conditionReferences = new Map(
    conditions.map((condition) => [
      condition.id,
      getConditionIndicatorIds(condition),
    ])
  )
  const eligibleConditions = conditions.filter(
    (condition) => referencedFailures(condition, syncFailures).length === 0
  )
  const requirements = getObservationRequirements(eligibleConditions)
  const observations: ObservationsByIndicator = {}
  const observationFailures = new Map<string, string>()

  await Promise.all(
    Object.entries(requirements).map(async ([indicatorId, limit]) => {
      try {
        observations[indicatorId] =
          await dependencies.store.loadIndicatorObservations(indicatorId, limit)
      } catch (error) {
        observationFailures.set(indicatorId, formatError(error))
      }
    })
  )

  const conditionResults: ConditionMonitoringResult[] = []

  for (const condition of conditions) {
    const evaluatedAt = now().toISOString()
    const failedSyncs = referencedFailures(condition, syncFailures)
    if (failedSyncs.length > 0) {
      const message = await persistConditionError(
        condition,
        `Skipped because a required indicator sync failed: ${failedSyncs.join("; ")}`,
        evaluatedAt,
        options,
        dependencies
      )
      conditionResults.push({
        conditionId: condition.id,
        conditionName: condition.name,
        status: "skipped",
        alertCreated: false,
        error: message,
      })
      continue
    }

    const failedLoads = (conditionReferences.get(condition.id) ?? [])
      .map((indicatorId) => observationFailures.get(indicatorId))
      .filter((message): message is string => Boolean(message))
    if (failedLoads.length > 0) {
      const message = await persistConditionError(
        condition,
        `Observation history loading failed: ${failedLoads.join("; ")}`,
        evaluatedAt,
        options,
        dependencies
      )
      conditionResults.push({
        conditionId: condition.id,
        conditionName: condition.name,
        status: "error",
        alertCreated: false,
        error: message,
      })
      continue
    }

    try {
      const evaluation = evaluateCondition(condition, observations)
      const evaluationErrors = [...evaluation.errors]
      if (evaluation.root) {
        collectEvaluationErrors(evaluation.root, evaluationErrors)
      }
      if (!evaluation.valid || evaluationErrors.length > 0) {
        const message = await persistConditionError(
          condition,
          evaluationErrors.join(" ") || "Condition evaluation failed.",
          evaluatedAt,
          options,
          dependencies
        )
        conditionResults.push({
          conditionId: condition.id,
          conditionName: condition.name,
          status: "error",
          alertCreated: false,
          error: message,
        })
        continue
      }

      if (options.dryRun) {
        conditionResults.push({
          conditionId: condition.id,
          conditionName: condition.name,
          status: evaluation.matched ? "true" : "false",
          matched: evaluation.matched,
          alertCreated: false,
        })
        continue
      }

      const transition = await dependencies.store.processConditionEvaluation({
        conditionId: condition.id,
        matched: evaluation.matched,
        evaluatedAt,
        message: `${condition.name} triggered`,
        payload: createAlertPayload(condition, evaluation, observations),
      })
      conditionResults.push({
        conditionId: condition.id,
        conditionName: condition.name,
        status: transition.alertCreated
          ? "triggered"
          : evaluation.matched
            ? "true"
            : "false",
        matched: evaluation.matched,
        alertCreated: transition.alertCreated,
        alertId: transition.alertId,
        previousMatched: transition.previousMatched,
      })
    } catch (error) {
      const message = await persistConditionError(
        condition,
        `Condition processing failed: ${formatError(error)}`,
        evaluatedAt,
        options,
        dependencies
      )
      conditionResults.push({
        conditionId: condition.id,
        conditionName: condition.name,
        status: "error",
        alertCreated: false,
        error: message,
      })
    }
  }

  const conditionErrors = conditionResults
    .filter((result) => result.error)
    .map((result) => ({
      conditionId: result.conditionId,
      conditionName: result.conditionName,
      message: result.error!,
    }))
  const triggered = conditionResults.filter(
    (result) => result.status === "triggered"
  ).length

  return {
    startedAt,
    completedAt: now().toISOString(),
    dryRun: options.dryRun === true,
    sync: {
      skipped: options.skipSync === true,
      total: syncResults.length,
      succeeded: syncResults.filter((result) => result.status === "succeeded")
        .length,
      failed: syncResults.filter((result) => result.status === "failed").length,
      results: syncResults,
    },
    conditions: {
      total: conditionResults.length,
      evaluated: conditionResults.filter((result) =>
        ["triggered", "true", "false"].includes(result.status)
      ).length,
      matched: conditionResults.filter((result) =>
        ["triggered", "true"].includes(result.status)
      ).length,
      triggered,
      skipped: conditionResults.filter((result) => result.status === "skipped")
        .length,
      failed: conditionResults.filter((result) => result.status === "error")
        .length,
      results: conditionResults,
      errors: conditionErrors,
    },
    alertsCreated: triggered,
  }
}
