import type { SupabaseClient } from "@supabase/supabase-js"

import {
  loadConditionTree,
  type ConditionGroupRow,
  type ConditionRuleRow,
  type ConditionSetRow,
} from "@/lib/conditions/tree-mappers"
import type { ConditionTree } from "@/lib/domain/conditions"

export async function loadConditionTrees(
  supabase: SupabaseClient,
  options: { enabledOnly?: boolean; conditionSetId?: string } = {}
): Promise<ConditionTree[]> {
  let setQuery = supabase
    .from("condition_sets")
    .select("id,name,description,enabled")

  if (options.enabledOnly) setQuery = setQuery.eq("enabled", true)
  if (options.conditionSetId) setQuery = setQuery.eq("id", options.conditionSetId)
  const setResult = await setQuery.order("created_at", { ascending: true })

  if (setResult.error) throw new Error(setResult.error.message)
  const sets = (setResult.data ?? []) as ConditionSetRow[]
  if (sets.length === 0) return []

  const setIds = sets.map(({ id }) => id)
  const groupResult = await supabase
    .from("condition_groups")
    .select("id,condition_set_id,parent_group_id,logical_operator,sort_order")
    .in("condition_set_id", setIds)
    .order("sort_order", { ascending: true })

  if (groupResult.error) throw new Error(groupResult.error.message)
  const groups = (groupResult.data ?? []) as ConditionGroupRow[]
  const groupIds = groups.map(({ id }) => id)
  const rules: ConditionRuleRow[] = []

  if (groupIds.length > 0) {
    const ruleResult = await supabase
      .from("condition_rules")
      .select(
        "id,group_id,indicator_id,rule_type,operator,parameters,enabled,sort_order,indicator:indicators!condition_rules_indicator_fk(id,symbol)"
      )
      .in("group_id", groupIds)
      .order("sort_order", { ascending: true })
    if (ruleResult.error) throw new Error(ruleResult.error.message)
    rules.push(...((ruleResult.data ?? []) as unknown as ConditionRuleRow[]))
  }

  return sets.map((set) => loadConditionTree(set, groups, rules))
}
