import { describe, expect, it } from "vitest"

import type {
  ConditionGroupNode,
  ConditionRuleNode,
  ConditionTree,
  MovingAverageRule,
  PercentageChangeRule,
  StreakBreakRule,
  StreakRule,
  ThresholdRule,
} from "@/lib/domain/conditions"
import type { Observation, ObservationsByIndicator } from "@/lib/domain/indicators"
import { evaluateCondition, evaluateGroup, evaluateRule } from "@/lib/rules/engine"

const indicatorA = "00000000-0000-4000-8000-000000000001"
const indicatorB = "00000000-0000-4000-8000-000000000002"

function id(number: number) {
  return `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`
}

function observations(indicatorId: string, values: number[]): Observation[] {
  return values.map((value, index) => ({
    id: id(100 + index),
    indicatorId,
    observedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    value,
    open: value,
    high: value,
    low: value,
    close: value,
    volume: null,
    buyVolume: null,
    metadata: {},
  }))
}

function threshold(
  number: number,
  indicatorId: string,
  operator: ThresholdRule["operator"],
  value: number,
  enabled = true
): ThresholdRule {
  return {
    kind: "rule",
    id: id(number),
    indicatorId,
    indicatorSymbol: indicatorId === indicatorA ? "A" : "B",
    ruleType: "threshold",
    operator,
    parameters: { value },
    enabled,
  }
}

function tree(root: ConditionGroupNode): ConditionTree {
  return {
    id: id(900),
    name: "Test condition",
    description: "",
    enabled: true,
    root,
  }
}

const source: ObservationsByIndicator = {
  [indicatorA]: observations(indicatorA, [8, 9, 10]),
  [indicatorB]: observations(indicatorB, [1, 2, 3]),
}

describe("threshold", () => {
  it("evaluates true and false comparisons", () => {
    expect(evaluateRule(threshold(1, indicatorA, "gt", 9), source[indicatorA]).matched).toBe(true)
    expect(evaluateRule(threshold(2, indicatorA, "lt", 9), source[indicatorA]).matched).toBe(false)
  })
})

describe("percentage_change", () => {
  const rule: PercentageChangeRule = {
    kind: "rule",
    id: id(3),
    indicatorId: indicatorA,
    indicatorSymbol: "A",
    enabled: true,
    ruleType: "percentage_change",
    operator: "gt",
    parameters: { threshold: 20, window: 2, window_unit: "period" },
  }

  it("evaluates true and false percentage changes", () => {
    expect(evaluateRule(rule, observations(indicatorA, [100, 110, 125])).matched).toBe(true)
    expect(evaluateRule({ ...rule, parameters: { ...rule.parameters, threshold: 30 } }, observations(indicatorA, [100, 110, 125])).matched).toBe(false)
  })
})

describe("streak", () => {
  const rule: StreakRule = {
    kind: "rule",
    id: id(4),
    indicatorId: indicatorA,
    indicatorSymbol: "A",
    enabled: true,
    ruleType: "streak",
    operator: "decreasing",
    parameters: { periods: 3, comparison: "previous_observation" },
  }

  it("requires every recent transition to follow the direction", () => {
    expect(evaluateRule(rule, observations(indicatorA, [5, 4, 3, 2])).matched).toBe(true)
    expect(evaluateRule(rule, observations(indicatorA, [5, 4, 4.5, 2])).matched).toBe(false)
  })
})

describe("streak_break", () => {
  const rule: StreakBreakRule = {
    kind: "rule",
    id: id(5),
    indicatorId: indicatorA,
    indicatorSymbol: "A",
    enabled: true,
    ruleType: "streak_break",
    operator: "decreasing",
    parameters: { periods: 2, comparison: "previous_observation" },
  }

  it("matches only when a prior streak breaks on the latest transition", () => {
    expect(evaluateRule(rule, observations(indicatorA, [5, 4, 3, 3.5])).matched).toBe(true)
    expect(evaluateRule(rule, observations(indicatorA, [5, 4, 3, 2])).matched).toBe(false)
  })
})

describe("moving_average", () => {
  const rule: MovingAverageRule = {
    kind: "rule",
    id: id(6),
    indicatorId: indicatorA,
    indicatorSymbol: "A",
    enabled: true,
    ruleType: "moving_average",
    operator: "gt",
    parameters: { window: 3 },
  }

  it("compares the latest value with the current moving average", () => {
    expect(evaluateRule(rule, observations(indicatorA, [1, 2, 6])).matched).toBe(true)
    expect(evaluateRule({ ...rule, operator: "lt" }, observations(indicatorA, [1, 2, 6])).matched).toBe(false)
  })

  it("supports crossing above", () => {
    const crossRule = { ...rule, operator: "cross_above" as const }
    expect(evaluateRule(crossRule, observations(indicatorA, [3, 3, 2, 5])).matched).toBe(true)
  })
})

describe("composite groups", () => {
  const trueRule = threshold(10, indicatorA, "gt", 5)
  const falseRule = threshold(11, indicatorA, "lt", 5)
  const trueB = threshold(12, indicatorB, "gt", 2)

  it("evaluates A AND B", () => {
    const root: ConditionGroupNode = { kind: "group", id: id(20), operator: "and", children: [trueRule, trueB] }
    expect(evaluateCondition(tree(root), source).matched).toBe(true)
  })

  it("evaluates A OR B", () => {
    const root: ConditionGroupNode = { kind: "group", id: id(21), operator: "or", children: [falseRule, trueB] }
    expect(evaluateCondition(tree(root), source).matched).toBe(true)
  })

  it("evaluates A AND (B OR C)", () => {
    const nested: ConditionGroupNode = { kind: "group", id: id(22), operator: "or", children: [falseRule, trueB] }
    const root: ConditionGroupNode = { kind: "group", id: id(23), operator: "and", children: [trueRule, nested] }
    expect(evaluateCondition(tree(root), source).matched).toBe(true)
  })

  it("evaluates multiple nested group levels", () => {
    const deepest: ConditionGroupNode = {
      kind: "group",
      id: id(24),
      operator: "and",
      children: [threshold(40, indicatorA, "gt", 5), threshold(41, indicatorB, "gt", 2)],
    }
    const middle: ConditionGroupNode = { kind: "group", id: id(25), operator: "or", children: [falseRule, deepest] }
    const root: ConditionGroupNode = { kind: "group", id: id(26), operator: "and", children: [trueRule, middle] }
    expect(evaluateCondition(tree(root), source).matched).toBe(true)
  })
})

describe("edge cases", () => {
  it("fails with a useful detail when observations are insufficient", () => {
    const rule: PercentageChangeRule = {
      kind: "rule",
      id: id(30),
      indicatorId: indicatorA,
      indicatorSymbol: "A",
      enabled: true,
      ruleType: "percentage_change",
      operator: "gt",
      parameters: { threshold: 0, window: 3, window_unit: "period" },
    }
    const result = evaluateRule(rule, observations(indicatorA, [1, 2]))
    expect(result.matched).toBe(false)
    expect(result.reason).toContain("Needs 4 observations")
  })

  it("excludes disabled rules from group logic", () => {
    const root: ConditionGroupNode = {
      kind: "group",
      id: id(31),
      operator: "and",
      children: [threshold(32, indicatorA, "gt", 5), threshold(33, indicatorA, "lt", 5, false)],
    }
    const result = evaluateGroup(root, source)
    expect(result.matched).toBe(true)
    expect(result.children[1].skipped).toBe(true)
  })

  it("fails closed for an empty group", () => {
    const root = { kind: "group", id: id(34), operator: "and", children: [] } as ConditionGroupNode
    expect(evaluateGroup(root, source).matched).toBe(false)
    expect(evaluateCondition(tree(root), source).valid).toBe(false)
  })

  it("rejects invalid rule parameters before evaluation", () => {
    const invalidRule = {
      ...threshold(35, indicatorA, "gt", 5),
      parameters: { value: "not-a-number" },
    } as unknown as ConditionRuleNode
    const root: ConditionGroupNode = { kind: "group", id: id(36), operator: "and", children: [invalidRule] }
    const result = evaluateCondition(tree(root), source)
    expect(result.valid).toBe(false)
    expect(result.matched).toBe(false)
  })
})
