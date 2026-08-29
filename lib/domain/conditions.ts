import { z } from "zod"

const uuidSchema = z.string().uuid()
const finiteNumber = z.number().finite()

export const comparisonOperatorSchema = z.enum([
  "gt",
  "gte",
  "lt",
  "lte",
  "eq",
])
export const directionSchema = z.enum(["increasing", "decreasing"])
export const movingAverageOperatorSchema = z.enum([
  "gt",
  "gte",
  "lt",
  "lte",
  "cross_above",
  "cross_below",
])

const ruleBaseSchema = z.object({
  kind: z.literal("rule"),
  id: uuidSchema,
  indicatorId: uuidSchema,
  indicatorSymbol: z.string().trim().min(1),
  enabled: z.boolean(),
})

export const thresholdRuleSchema = ruleBaseSchema.extend({
  ruleType: z.literal("threshold"),
  operator: comparisonOperatorSchema,
  parameters: z.object({ value: finiteNumber }),
})

export const percentageChangeRuleSchema = ruleBaseSchema.extend({
  ruleType: z.literal("percentage_change"),
  operator: comparisonOperatorSchema,
  parameters: z.object({
    threshold: finiteNumber,
    window: z.number().int().min(1).max(10_000),
    window_unit: z.enum(["period", "observation", "day"]),
  }),
})

export const streakRuleSchema = ruleBaseSchema.extend({
  ruleType: z.literal("streak"),
  operator: directionSchema,
  parameters: z.object({
    periods: z.number().int().min(1).max(10_000),
    comparison: z.literal("previous_observation"),
  }),
})

export const streakBreakRuleSchema = ruleBaseSchema.extend({
  ruleType: z.literal("streak_break"),
  operator: directionSchema,
  parameters: z.object({
    periods: z.number().int().min(1).max(10_000),
    comparison: z.literal("previous_observation"),
  }),
})

export const movingAverageRuleSchema = ruleBaseSchema.extend({
  ruleType: z.literal("moving_average"),
  operator: movingAverageOperatorSchema,
  parameters: z.object({
    window: z.number().int().min(2).max(10_000),
  }),
})

export const conditionRuleSchema = z.discriminatedUnion("ruleType", [
  thresholdRuleSchema,
  percentageChangeRuleSchema,
  streakRuleSchema,
  streakBreakRuleSchema,
  movingAverageRuleSchema,
])

export type ComparisonOperator = z.infer<typeof comparisonOperatorSchema>
export type Direction = z.infer<typeof directionSchema>
export type RuleType = z.infer<typeof conditionRuleSchema>["ruleType"]
export type ConditionRuleNode = z.infer<typeof conditionRuleSchema>
export type ThresholdRule = z.infer<typeof thresholdRuleSchema>
export type PercentageChangeRule = z.infer<typeof percentageChangeRuleSchema>
export type StreakRule = z.infer<typeof streakRuleSchema>
export type StreakBreakRule = z.infer<typeof streakBreakRuleSchema>
export type MovingAverageRule = z.infer<typeof movingAverageRuleSchema>

export interface ConditionGroupNode {
  kind: "group"
  id: string
  operator: "and" | "or"
  children: ConditionNode[]
}

export type ConditionNode = ConditionGroupNode | ConditionRuleNode

export const conditionGroupSchema: z.ZodType<ConditionGroupNode> = z.lazy(() =>
  z.object({
    kind: z.literal("group"),
    id: uuidSchema,
    operator: z.enum(["and", "or"]),
    // Empty groups evaluate ambiguously, so the MVP rejects them on save.
    children: z
      .array(z.union([conditionRuleSchema, conditionGroupSchema]))
      .min(1, "Add at least one rule or nested group."),
  })
)

export const conditionTreeSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2_000),
  enabled: z.boolean(),
  root: conditionGroupSchema,
})

export type ConditionTree = z.infer<typeof conditionTreeSchema>

export interface TreeValidationResult {
  success: boolean
  tree?: ConditionTree
  errors: string[]
}

function hasObjectCycle(value: unknown, active = new WeakSet<object>()): boolean {
  if (!value || typeof value !== "object") return false
  const object = value as object
  if (active.has(object)) return true
  active.add(object)
  const children = Array.isArray(value) ? value : Object.values(value)
  const cyclic = children.some((child) => hasObjectCycle(child, active))
  active.delete(object)
  return cyclic
}

export function validateConditionTree(input: unknown): TreeValidationResult {
  if (hasObjectCycle(input)) {
    return { success: false, errors: ["Condition tree contains a cycle."] }
  }

  const parsed = conditionTreeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => {
        const path = issue.path.length ? issue.path.join(".") : "condition"
        return `${path}: ${issue.message}`
      }),
    }
  }

  const ids = new Set<string>()
  const errors: string[] = []
  const visit = (node: ConditionNode) => {
    if (ids.has(node.id)) errors.push(`Duplicate node id: ${node.id}`)
    ids.add(node.id)
    if (node.kind === "group") node.children.forEach(visit)
  }
  visit(parsed.data.root)

  return errors.length
    ? { success: false, errors }
    : { success: true, tree: parsed.data, errors: [] }
}

export interface IndicatorOption {
  id: string
  symbol: string
}

export function createRule(
  ruleType: RuleType,
  indicator: IndicatorOption
): ConditionRuleNode {
  const base = {
    kind: "rule" as const,
    id: crypto.randomUUID(),
    indicatorId: indicator.id,
    indicatorSymbol: indicator.symbol,
    enabled: true,
  }

  switch (ruleType) {
    case "threshold":
      return { ...base, ruleType, operator: "gt", parameters: { value: 0 } }
    case "percentage_change":
      return {
        ...base,
        ruleType,
        operator: "gt",
        parameters: { threshold: 0, window: 1, window_unit: "period" },
      }
    case "streak":
      return {
        ...base,
        ruleType,
        operator: "decreasing",
        parameters: { periods: 5, comparison: "previous_observation" },
      }
    case "streak_break":
      return {
        ...base,
        ruleType,
        operator: "decreasing",
        parameters: { periods: 5, comparison: "previous_observation" },
      }
    case "moving_average":
      return {
        ...base,
        ruleType,
        operator: "gt",
        parameters: { window: 20 },
      }
  }
}

export function createConditionTree(indicator: IndicatorOption): ConditionTree {
  return {
    id: crypto.randomUUID(),
    name: "Untitled condition",
    description: "",
    enabled: true,
    root: {
      kind: "group",
      id: crypto.randomUUID(),
      operator: "and",
      children: [createRule("threshold", indicator)],
    },
  }
}
