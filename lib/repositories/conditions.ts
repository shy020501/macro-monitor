import "server-only"

import type { ConditionTree } from "@/lib/domain/conditions"
import { validateConditionTree } from "@/lib/domain/conditions"
import { conditionRulesAreEqual } from "@/lib/conditions/semantics"
import {
  saveConditionTree,
} from "@/lib/conditions/tree-mappers"
import { loadConditionTrees } from "@/lib/repositories/condition-trees"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function getConditionTrees(): Promise<ConditionTree[]> {
  return loadConditionTrees(createSupabaseServerClient())
}

export async function persistConditionTree(input: unknown): Promise<string> {
  const validation = validateConditionTree(input)
  if (!validation.success || !validation.tree) {
    throw new Error(validation.errors.join(" "))
  }
  const tree = validation.tree
  const flat = saveConditionTree(tree)
  const supabase = createSupabaseServerClient()
  const existing = (
    await loadConditionTrees(supabase, { conditionSetId: tree.id })
  )[0]

  if (existing && conditionRulesAreEqual(existing, tree)) {
    const { data, error } = await supabase
      .from("condition_sets")
      .update({
        name: tree.name,
        description: tree.description || null,
        enabled: tree.enabled,
      })
      .eq("id", tree.id)
      .select("id")
      .single()
    if (error) throw new Error(error.message)
    return String(data.id)
  }

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
