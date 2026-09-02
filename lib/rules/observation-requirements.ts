import type {
  ConditionNode,
  ConditionRuleNode,
  ConditionTree,
} from "@/lib/domain/conditions"

export function requiredObservationCount(rule: ConditionRuleNode): number {
  if (!rule.enabled) return 0

  switch (rule.ruleType) {
    case "threshold":
      return 1
    case "percentage_change":
      return rule.parameters.window + 1
    case "streak":
      return rule.parameters.periods + 1
    case "streak_break":
      return rule.parameters.periods + 2
    case "moving_average":
      return rule.parameters.window +
        (rule.operator === "cross_above" || rule.operator === "cross_below"
          ? 1
          : 0)
  }
}

function collectNodeRequirements(
  node: ConditionNode,
  requirements: Record<string, number>
): void {
  if (node.kind === "group") {
    node.children.forEach((child) =>
      collectNodeRequirements(child, requirements)
    )
    return
  }

  const required = requiredObservationCount(node)
  if (required > 0) {
    requirements[node.indicatorId] = Math.max(
      requirements[node.indicatorId] ?? 0,
      required
    )
  }
}

export function getObservationRequirements(
  conditions: readonly ConditionTree[]
): Record<string, number> {
  const requirements: Record<string, number> = {}
  conditions.forEach((condition) =>
    collectNodeRequirements(condition.root, requirements)
  )
  return requirements
}
