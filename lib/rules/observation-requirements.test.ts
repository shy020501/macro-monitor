import { describe, expect, it } from "vitest"

import type {
  ConditionRuleNode,
  ConditionTree,
} from "@/lib/domain/conditions"
import {
  getObservationRequirements,
  requiredObservationCount,
} from "@/lib/rules/observation-requirements"

const indicatorA = "00000000-0000-4000-8000-000000000001"
const indicatorB = "00000000-0000-4000-8000-000000000002"

function rule(
  value: Omit<ConditionRuleNode, "kind" | "id" | "indicatorSymbol">
): ConditionRuleNode {
  return {
    ...value,
    kind: "rule",
    id: crypto.randomUUID(),
    indicatorSymbol: "TEST",
  } as ConditionRuleNode
}

describe("observation requirements", () => {
  it("matches the Rule Engine requirements for every rule type", () => {
    expect(
      requiredObservationCount(
        rule({
          indicatorId: indicatorA,
          enabled: true,
          ruleType: "percentage_change",
          operator: "gt",
          parameters: { threshold: 1, window: 20, window_unit: "period" },
        })
      )
    ).toBe(21)
    expect(
      requiredObservationCount(
        rule({
          indicatorId: indicatorA,
          enabled: true,
          ruleType: "streak_break",
          operator: "increasing",
          parameters: { periods: 5, comparison: "previous_observation" },
        })
      )
    ).toBe(7)
    expect(
      requiredObservationCount(
        rule({
          indicatorId: indicatorA,
          enabled: true,
          ruleType: "moving_average",
          operator: "cross_above",
          parameters: { window: 120 },
        })
      )
    ).toBe(121)
  })

  it("keeps the largest enabled requirement for each indicator", () => {
    const conditions = [
      {
        id: crypto.randomUUID(),
        name: "Requirements",
        description: "",
        enabled: true,
        root: {
          kind: "group",
          id: crypto.randomUUID(),
          operator: "and",
          children: [
            rule({
              indicatorId: indicatorA,
              enabled: true,
              ruleType: "threshold",
              operator: "gt",
              parameters: { value: 1 },
            }),
            rule({
              indicatorId: indicatorA,
              enabled: true,
              ruleType: "streak",
              operator: "decreasing",
              parameters: { periods: 9, comparison: "previous_observation" },
            }),
            rule({
              indicatorId: indicatorB,
              enabled: false,
              ruleType: "moving_average",
              operator: "gt",
              parameters: { window: 100 },
            }),
          ],
        },
      } satisfies ConditionTree,
    ]

    expect(getObservationRequirements(conditions)).toEqual({
      [indicatorA]: 10,
    })
  })
})
