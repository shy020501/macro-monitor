import type { SupabaseClient } from "@supabase/supabase-js"

import type { JsonObject } from "@/lib/domain/indicators"
import type { IngestionIndicator } from "@/lib/ingestion/types"
import type {
  ConditionTransitionResult,
  MonitoringStore,
  ProcessConditionEvaluationInput,
} from "@/lib/monitoring/types"
import { loadConditionTrees } from "@/lib/repositories/condition-trees"
import { loadIndicatorObservations } from "@/lib/repositories/indicator-observations"

interface IndicatorRow {
  id: string
  symbol: string
  source: string
  metadata: JsonObject | null
}

interface TransitionRow {
  alert_created: boolean
  alert_id: string | null
  previous_matched: boolean | null
  current_matched: boolean | null
}

const nonExternalSources = new Set(["seed", "mock"])

function toIndicator(row: IndicatorRow): IngestionIndicator {
  return {
    id: row.id,
    symbol: row.symbol,
    source: row.source,
    metadata: row.metadata ?? {},
  }
}

async function processConditionEvaluation(
  supabase: SupabaseClient,
  input: ProcessConditionEvaluationInput
): Promise<ConditionTransitionResult> {
  const { data, error } = await supabase.rpc("process_condition_evaluation", {
    p_condition_set_id: input.conditionId,
    p_matched: input.matched,
    p_evaluated_at: input.evaluatedAt,
    p_error: input.error ?? null,
    p_message: input.message ?? null,
    p_payload: input.payload ?? {},
  })

  if (error) throw new Error(error.message)
  const row = (Array.isArray(data) ? data[0] : data) as TransitionRow | null
  if (!row) throw new Error("Condition transition RPC returned no result.")

  return {
    alertCreated: row.alert_created,
    alertId: row.alert_id,
    previousMatched: row.previous_matched,
    currentMatched: row.current_matched,
  }
}

export function createSupabaseMonitoringStore(
  supabase: SupabaseClient
): MonitoringStore {
  return {
    async listSyncIndicators() {
      const { data, error } = await supabase
        .from("indicators")
        .select("id,symbol,source,metadata")
        .order("symbol")
      if (error) throw new Error(error.message)

      return ((data ?? []) as IndicatorRow[])
        .map(toIndicator)
        .filter(
          (indicator) =>
            !nonExternalSources.has(indicator.source.trim().toLowerCase())
        )
    },

    listEnabledConditions() {
      return loadConditionTrees(supabase, { enabledOnly: true })
    },

    loadIndicatorObservations(indicatorId, limit) {
      return loadIndicatorObservations(supabase, indicatorId, limit)
    },

    processConditionEvaluation(input) {
      return processConditionEvaluation(supabase, input)
    },
  }
}
