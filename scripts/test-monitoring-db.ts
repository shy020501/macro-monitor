import { loadEnvConfig } from "@next/env"
import { createClient } from "@supabase/supabase-js"

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured in .env.local.`)
  return value
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd())
  const supabase = createClient(
    requiredEnvironmentValue("SUPABASE_URL"),
    requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const conditionId = crypto.randomUUID()
  const testRun = crypto.randomUUID()

  const processEvaluation = async (
    matched: boolean | null,
    error: string | null = null
  ) => {
    const result = await supabase.rpc("process_condition_evaluation", {
      p_condition_set_id: conditionId,
      p_matched: matched,
      p_evaluated_at: new Date().toISOString(),
      p_error: error,
      p_message: "Monitoring DB integration test triggered",
      p_payload: { monitoring_test_run: testRun },
    })
    if (result.error) throw new Error(result.error.message)
    const row = Array.isArray(result.data) ? result.data[0] : result.data
    assert(row, "Transition RPC returned no row.")
    return row as {
      alert_created: boolean
      alert_id: string | null
      previous_matched: boolean | null
      current_matched: boolean | null
    }
  }

  try {
    const inserted = await supabase.from("condition_sets").insert({
      id: conditionId,
      name: "Monitoring DB integration test",
      description: "Temporary row",
      enabled: true,
      metadata: { monitoring_test_run: testRun },
    })
    if (inserted.error) throw new Error(inserted.error.message)

    const firstFalse = await processEvaluation(false)
    assert(!firstFalse.alert_created, "Initial false evaluation created an alert.")

    const concurrent = await Promise.all([
      processEvaluation(true),
      processEvaluation(true),
    ])
    assert(
      concurrent.filter((row) => row.alert_created).length === 1,
      "Concurrent false-to-true evaluations did not create exactly one alert."
    )

    const stillTrue = await processEvaluation(true)
    assert(!stillTrue.alert_created, "Repeated true evaluation created an alert.")

    const resetFalse = await processEvaluation(false)
    assert(!resetFalse.alert_created, "True-to-false evaluation created an alert.")

    const secondTrue = await processEvaluation(true)
    assert(secondTrue.alert_created, "Second false-to-true transition did not alert.")

    await processEvaluation(null, "temporary provider error")
    const state = await supabase
      .from("condition_runtime_states")
      .select("last_matched,last_error")
      .eq("condition_set_id", conditionId)
      .single()
    if (state.error) throw new Error(state.error.message)
    assert(
      state.data.last_matched === true,
      "Evaluation error changed the successful last_matched state."
    )
    assert(
      state.data.last_error === "temporary provider error",
      "Evaluation error was not recorded."
    )

    const renamed = await supabase
      .from("condition_sets")
      .update({ name: "Renamed monitoring DB integration test" })
      .eq("id", conditionId)
    if (renamed.error) throw new Error(renamed.error.message)
    const stateAfterRename = await supabase
      .from("condition_runtime_states")
      .select("condition_set_id")
      .eq("condition_set_id", conditionId)
      .maybeSingle()
    if (stateAfterRename.error) throw new Error(stateAfterRename.error.message)
    assert(
      stateAfterRename.data,
      "A name-only edit unexpectedly reset runtime state."
    )

    const disabled = await supabase
      .from("condition_sets")
      .update({ enabled: false })
      .eq("id", conditionId)
    if (disabled.error) throw new Error(disabled.error.message)
    const stateAfterDisable = await supabase
      .from("condition_runtime_states")
      .select("condition_set_id")
      .eq("condition_set_id", conditionId)
      .maybeSingle()
    if (stateAfterDisable.error) throw new Error(stateAfterDisable.error.message)
    assert(
      stateAfterDisable.data === null,
      "An enabled-state change did not reset runtime state."
    )

    const reenabled = await supabase
      .from("condition_sets")
      .update({ enabled: true })
      .eq("id", conditionId)
    if (reenabled.error) throw new Error(reenabled.error.message)
    await processEvaluation(false)

    const groupId = crypto.randomUUID()
    const groupInsert = await supabase.from("condition_groups").insert({
      id: groupId,
      condition_set_id: conditionId,
      parent_group_id: null,
      logical_operator: "and",
      sort_order: 0,
    })
    if (groupInsert.error) throw new Error(groupInsert.error.message)
    const stateAfterGroup = await supabase
      .from("condition_runtime_states")
      .select("condition_set_id")
      .eq("condition_set_id", conditionId)
      .maybeSingle()
    if (stateAfterGroup.error) throw new Error(stateAfterGroup.error.message)
    assert(
      stateAfterGroup.data === null,
      "A group change did not reset runtime state."
    )

    await processEvaluation(false)
    const indicator = await supabase
      .from("indicators")
      .select("id")
      .limit(1)
      .single()
    if (indicator.error) throw new Error(indicator.error.message)
    const ruleInsert = await supabase.from("condition_rules").insert({
      id: crypto.randomUUID(),
      group_id: groupId,
      indicator_id: indicator.data.id,
      rule_type: "threshold",
      operator: "gt",
      parameters: { value: 0 },
      enabled: true,
      sort_order: 0,
    })
    if (ruleInsert.error) throw new Error(ruleInsert.error.message)
    const stateAfterRule = await supabase
      .from("condition_runtime_states")
      .select("condition_set_id")
      .eq("condition_set_id", conditionId)
      .maybeSingle()
    if (stateAfterRule.error) throw new Error(stateAfterRule.error.message)
    assert(
      stateAfterRule.data === null,
      "A rule change did not reset runtime state."
    )

    const alerts = await supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("payload->>monitoring_test_run", testRun)
    if (alerts.error) throw new Error(alerts.error.message)
    assert(alerts.count === 2, `Expected 2 alerts; found ${alerts.count ?? 0}.`)

    console.log("Monitoring DB transition integration test passed.")
  } finally {
    const alertCleanup = await supabase
      .from("alerts")
      .delete()
      .eq("payload->>monitoring_test_run", testRun)
    const conditionCleanup = await supabase
      .from("condition_sets")
      .delete()
      .eq("id", conditionId)

    if (alertCleanup.error) {
      console.error(`Alert cleanup failed: ${alertCleanup.error.message}`)
    }
    if (conditionCleanup.error) {
      console.error(`Condition cleanup failed: ${conditionCleanup.error.message}`)
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Monitoring DB integration test failed."
  )
  process.exitCode = 1
})
