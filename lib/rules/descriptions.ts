import type { ConditionGroupNode, ConditionRuleNode } from "@/lib/domain/conditions"

const comparisonLabels = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  eq: "=",
} as const

export function describeRule(rule: ConditionRuleNode): string {
  switch (rule.ruleType) {
    case "threshold":
      return `${rule.indicatorSymbol} ${comparisonLabels[rule.operator]} ${rule.parameters.value}`
    case "percentage_change":
      return `${rule.indicatorSymbol} ${rule.parameters.window}-period change ${comparisonLabels[rule.operator]} ${rule.parameters.threshold}%`
    case "streak":
      return `${rule.indicatorSymbol} ${rule.operator === "increasing" ? "increases" : "decreases"} for ${rule.parameters.periods} periods`
    case "streak_break":
      return `${rule.indicatorSymbol} breaks a ${rule.parameters.periods}-period ${rule.operator === "increasing" ? "rise" : "decline"}`
    case "moving_average": {
      const operation =
        rule.operator === "cross_above"
          ? "crosses above"
          : rule.operator === "cross_below"
            ? "crosses below"
            : comparisonLabels[rule.operator]
      return `${rule.indicatorSymbol} ${operation} MA${rule.parameters.window}`
    }
  }
}

export function describeGroup(group: ConditionGroupNode): string {
  const enabledDescriptions = group.children
    .filter((child) => child.kind === "group" || child.enabled)
    .map((child) =>
      child.kind === "group" ? `(${describeGroup(child)})` : describeRule(child)
    )
  return enabledDescriptions.join(` ${group.operator.toUpperCase()} `)
}
