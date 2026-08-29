import "server-only"

import type { ConditionTree } from "@/lib/domain/conditions"
import { validateConditionTree } from "@/lib/domain/conditions"
import {
  loadConditionTree,
  saveConditionTree,
  type ConditionGroupRow,
  type ConditionRuleRow,
  type ConditionSetRow,
} from "@/lib/conditions/tree-mappers"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function getConditionTrees(): Promise<ConditionTree[]> {
  const supabase = createSupabaseServerClient()
  const setResult = await supabase
    .from("condition_sets")
    .select("id,name,description,enabled")
    .order("created_at", { ascending: true })

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

export async function persistConditionTree(input: unknown): Promise<string> {
  const validation = validateConditionTree(input)
  if (!validation.success || !validation.tree) {
    throw new Error(validation.errors.join(" "))
  }
  const tree = validation.tree
  const flat = saveConditionTree(tree)
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.rpc("save_condition_tree", {
    p_condition_set_id: tree.id,
    p_name: tree.name,
    p_description: tree.description || null,
    p_enabled: tree.enabled,
    p_groups: flat.groups,
    p_rules: flat.rules,
  })

  if (error) throw new Error(error.message)
  return String(data)
}

export async function deleteConditionSet(conditionId: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("condition_sets")
    .delete()
    .eq("id", conditionId)
    .select("id")

  if (error) throw new Error(error.message)
  if (data.length !== 1) throw new Error("Condition set not found.")
}
