import { describe, expect, it } from "vitest"

import type { ConditionTree } from "@/lib/domain/conditions"
import { conditionRulesAreEqual } from "@/lib/conditions/semantics"

function tree(): ConditionTree {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Original",
    description: "Original description",
    enabled: true,
    root: {
      kind: "group",
      id: "20000000-0000-4000-8000-000000000001",
      operator: "and",
      children: [
        {
          kind: "rule",
          id: "30000000-0000-4000-8000-000000000001",
          indicatorId: "40000000-0000-4000-8000-000000000001",
          indicatorSymbol: "TEST",
          enabled: true,
          ruleType: "threshold",
          operator: "gt",
          parameters: { value: 10 },
        },
      ],
    },
  }
}

describe("conditionRulesAreEqual", () => {
  it("ignores name, description, enabled, and object key order", () => {
    const left = tree()
    const right = {
      ...tree(),
      name: "Renamed",
      description: "Changed description",
      enabled: false,
    }
    expect(conditionRulesAreEqual(left, right)).toBe(true)
  })

  it("detects a rule meaning change", () => {
    const left = tree()
    const right = tree()
    const rule = right.root.children[0]
    if (rule.kind !== "rule" || rule.ruleType !== "threshold") {
      throw new Error("Unexpected fixture")
    }
    rule.parameters.value = 11
    expect(conditionRulesAreEqual(left, right)).toBe(false)
  })
})
