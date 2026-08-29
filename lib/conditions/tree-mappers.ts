import type {
  ConditionGroupNode,
  ConditionRuleNode,
  ConditionTree,
} from "@/lib/domain/conditions"
import { conditionRuleSchema, validateConditionTree } from "@/lib/domain/conditions"

export interface ConditionSetRow {
  id: string
  name: string
  description: string | null
  enabled: boolean
}

export interface ConditionGroupRow {
  id: string
  condition_set_id: string
  parent_group_id: string | null
  logical_operator: "and" | "or"
  sort_order: number
}

export interface ConditionRuleRow {
  id: string
  group_id: string
  indicator_id: string
  rule_type: string
  operator: string
  parameters: unknown
  enabled: boolean
  sort_order: number
  indicator: { id: string; symbol: string } | Array<{ id: string; symbol: string }>
}

function getIndicator(rule: ConditionRuleRow) {
  return Array.isArray(rule.indicator) ? rule.indicator[0] : rule.indicator
}

export function loadConditionTree(
  conditionSet: ConditionSetRow,
  groupRows: ConditionGroupRow[],
  ruleRows: ConditionRuleRow[]
): ConditionTree {
  const groups = groupRows.filter(
    (group) => group.condition_set_id === conditionSet.id
  )
  const groupIds = new Set(groups.map((group) => group.id))
  const relevantRules = ruleRows.filter((rule) => groupIds.has(rule.group_id))
  const roots = groups.filter((group) => group.parent_group_id === null)
  if (roots.length !== 1) {
    throw new Error(
      `Condition ${conditionSet.id} must have exactly one root; found ${roots.length}.`
    )
  }

  const byId = new Map(groups.map((group) => [group.id, group]))
  const childGroups = new Map<string, ConditionGroupRow[]>()
  const childRules = new Map<string, ConditionRuleRow[]>()

  for (const group of groups) {
    if (!group.parent_group_id) continue
    if (!byId.has(group.parent_group_id)) {
      throw new Error(`Orphan group ${group.id} has no parent in its condition.`)
    }
    const siblings = childGroups.get(group.parent_group_id) ?? []
    siblings.push(group)
    childGroups.set(group.parent_group_id, siblings)
  }
  for (const rule of relevantRules) {
    const siblings = childRules.get(rule.group_id) ?? []
    siblings.push(rule)
    childRules.set(rule.group_id, siblings)
  }

  const visited = new Set<string>()
  const buildGroup = (
    row: ConditionGroupRow,
    ancestors: Set<string>
  ): ConditionGroupNode => {
    if (ancestors.has(row.id)) {
      throw new Error(`Cycle detected at condition group ${row.id}.`)
    }
    const nextAncestors = new Set(ancestors).add(row.id)
    visited.add(row.id)

    const groupChildren = (childGroups.get(row.id) ?? []).map((group) => ({
      sortOrder: group.sort_order,
      tieBreaker: `group-${group.id}`,
      node: buildGroup(group, nextAncestors) as ConditionGroupNode | ConditionRuleNode,
    }))
    const ruleChildren = (childRules.get(row.id) ?? []).map((rule) => {
      const indicator = getIndicator(rule)
      if (!indicator) throw new Error(`Rule ${rule.id} has no indicator.`)
      const node = conditionRuleSchema.parse({
        kind: "rule",
        id: rule.id,
        indicatorId: rule.indicator_id,
        indicatorSymbol: indicator.symbol,
        ruleType: rule.rule_type,
        operator: rule.operator,
        parameters: rule.parameters,
        enabled: rule.enabled,
      })
      return {
        sortOrder: rule.sort_order,
        tieBreaker: `rule-${rule.id}`,
        node: node as ConditionGroupNode | ConditionRuleNode,
      }
    })

    return {
      kind: "group",
      id: row.id,
      operator: row.logical_operator,
      children: [...groupChildren, ...ruleChildren]
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.tieBreaker.localeCompare(b.tieBreaker)
        )
        .map(({ node }) => node),
    }
  }

  const tree: ConditionTree = {
    id: conditionSet.id,
    name: conditionSet.name,
    description: conditionSet.description ?? "",
    enabled: conditionSet.enabled,
    root: buildGroup(roots[0], new Set()),
  }

  if (visited.size !== groups.length) {
    throw new Error("Condition contains an orphaned or cyclic group component.")
  }
  const validated = validateConditionTree(tree)
  if (!validated.success || !validated.tree) {
    throw new Error(validated.errors.join(" "))
  }
  return validated.tree
}

export interface FlatConditionTree {
  groups: Array<{
    id: string
    parent_group_id: string | null
    logical_operator: "and" | "or"
    sort_order: number
  }>
  rules: Array<{
    id: string
    group_id: string
    indicator_id: string
    rule_type: string
    operator: string
    parameters: Record<string, unknown>
    enabled: boolean
    sort_order: number
  }>
}

export function saveConditionTree(tree: ConditionTree): FlatConditionTree {
  const groups: FlatConditionTree["groups"] = []
  const rules: FlatConditionTree["rules"] = []

  const flattenGroup = (
    group: ConditionGroupNode,
    parentGroupId: string | null,
    sortOrder: number
  ) => {
    // Preorder is intentional: the SQL RPC inserts every parent before its children.
    groups.push({
      id: group.id,
      parent_group_id: parentGroupId,
      logical_operator: group.operator,
      sort_order: sortOrder,
    })
    group.children.forEach((child, index) => {
      if (child.kind === "group") flattenGroup(child, group.id, index)
      else {
        rules.push({
          id: child.id,
          group_id: group.id,
          indicator_id: child.indicatorId,
          rule_type: child.ruleType,
          operator: child.operator,
          parameters: child.parameters,
          enabled: child.enabled,
          sort_order: index,
        })
      }
    })
  }

  flattenGroup(tree.root, null, 0)
  return { groups, rules }
}
