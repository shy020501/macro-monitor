import type {
  ConditionGroupNode,
  ConditionRuleNode,
  ConditionTree,
  Direction,
} from "@/lib/domain/conditions"
import { conditionRuleSchema, validateConditionTree } from "@/lib/domain/conditions"
import type {
  Observation,
  ObservationsByIndicator,
} from "@/lib/domain/indicators"
import { describeGroup, describeRule } from "@/lib/rules/descriptions"

export interface RuleEvaluation {
  kind: "rule"
  id: string
  matched: boolean
  skipped: boolean
  description: string
  actual: unknown
  expected: unknown
  reason?: string
}

export interface GroupEvaluation {
  kind: "group"
  id: string
  operator: "and" | "or"
  matched: boolean
  skipped: false
  description: string
  reason?: string
  children: Array<GroupEvaluation | RuleEvaluation>
}

export interface ConditionEvaluation {
  conditionId: string
  matched: boolean
  description: string
  evaluatedAt: string
  valid: boolean
  errors: string[]
  root?: GroupEvaluation
}

function compare(actual: number, operator: string, expected: number): boolean {
  switch (operator) {
    case "gt":
      return actual > expected
    case "gte":
      return actual >= expected
    case "lt":
      return actual < expected
    case "lte":
      return actual <= expected
    case "eq":
      return actual === expected
    default:
      return false
  }
}

function ordered(observations: Observation[]): Observation[] {
  return [...observations].sort(
    (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)
  )
}

function followsDirection(
  previous: number,
  current: number,
  direction: Direction
): boolean {
  return direction === "increasing" ? current > previous : current < previous
}

function insufficient(
  rule: ConditionRuleNode,
  required: number,
  available: number
): RuleEvaluation {
  return {
    kind: "rule",
    id: rule.id,
    matched: false,
    skipped: false,
    description: describeRule(rule),
    actual: { availableObservations: available },
    expected: { requiredObservations: required },
    reason: `Needs ${required} observations; ${available} available.`,
  }
}

export function evaluateRule(
  input: ConditionRuleNode,
  source: Observation[]
): RuleEvaluation {
  const parsed = conditionRuleSchema.safeParse(input)
  if (!parsed.success) {
    return {
      kind: "rule",
      id: typeof input?.id === "string" ? input.id : "invalid-rule",
      matched: false,
      skipped: false,
      description: "Invalid rule",
      actual: null,
      expected: null,
      reason: parsed.error.issues.map((issue) => issue.message).join("; "),
    }
  }

  const rule = parsed.data
  if (!rule.enabled) {
    return {
      kind: "rule",
      id: rule.id,
      matched: false,
      skipped: true,
      description: describeRule(rule),
      actual: null,
      expected: null,
      reason: "Disabled rules are excluded from their group evaluation.",
    }
  }

  const observations = ordered(source)
  const latest = observations.at(-1)
  if (!latest) return insufficient(rule, 1, 0)

  switch (rule.ruleType) {
    case "threshold": {
      return {
        kind: "rule",
        id: rule.id,
        matched: compare(latest.value, rule.operator, rule.parameters.value),
        skipped: false,
        description: describeRule(rule),
        actual: latest.value,
        expected: { operator: rule.operator, value: rule.parameters.value },
      }
    }

    case "percentage_change": {
      const required = rule.parameters.window + 1
      if (observations.length < required) {
        return insufficient(rule, required, observations.length)
      }
      const previous = observations.at(-(rule.parameters.window + 1))!
      if (previous.value === 0) {
        return {
          ...insufficient(rule, required, observations.length),
          reason: "Percentage change is undefined because the comparison value is zero.",
        }
      }
      const percentageChange =
        ((latest.value - previous.value) / Math.abs(previous.value)) * 100
      return {
        kind: "rule",
        id: rule.id,
        matched: compare(
          percentageChange,
          rule.operator,
          rule.parameters.threshold
        ),
        skipped: false,
        description: describeRule(rule),
        actual: percentageChange,
        expected: {
          operator: rule.operator,
          threshold: rule.parameters.threshold,
          window: rule.parameters.window,
        },
      }
    }

    case "streak": {
      const required = rule.parameters.periods + 1
      if (observations.length < required) {
        return insufficient(rule, required, observations.length)
      }
      const values = observations.slice(-required).map(({ value }) => value)
      const matched = values
        .slice(1)
        .every((value, index) =>
          followsDirection(values[index], value, rule.operator)
        )
      return {
        kind: "rule",
        id: rule.id,
        matched,
        skipped: false,
        description: describeRule(rule),
        actual: { values, transitions: rule.parameters.periods },
        expected: { direction: rule.operator },
      }
    }

    case "streak_break": {
      const required = rule.parameters.periods + 2
      if (observations.length < required) {
        return insufficient(rule, required, observations.length)
      }
      const values = observations.slice(-required).map(({ value }) => value)
      const streakValues = values.slice(0, -1)
      const hadStreak = streakValues
        .slice(1)
        .every((value, index) =>
          followsDirection(streakValues[index], value, rule.operator)
        )
      const latestContinues = followsDirection(
        values.at(-2)!,
        values.at(-1)!,
        rule.operator
      )
      return {
        kind: "rule",
        id: rule.id,
        matched: hadStreak && !latestContinues,
        skipped: false,
        description: describeRule(rule),
        actual: { values, hadStreak, latestContinues },
        expected: {
          direction: rule.operator,
          periodsBeforeBreak: rule.parameters.periods,
        },
      }
    }

    case "moving_average": {
      const window = rule.parameters.window
      const isCross =
        rule.operator === "cross_above" || rule.operator === "cross_below"
      const required = isCross ? window + 1 : window
      if (observations.length < required) {
        return insufficient(rule, required, observations.length)
      }

      const currentWindow = observations.slice(-window)
      const currentAverage =
        currentWindow.reduce((sum, item) => sum + item.value, 0) / window
      let matched: boolean
      let actual: unknown = { value: latest.value, average: currentAverage }

      if (rule.operator === "cross_above" || rule.operator === "cross_below") {
        const previousWindow = observations.slice(-(window + 1), -1)
        const previousAverage =
          previousWindow.reduce((sum, item) => sum + item.value, 0) / window
        const previousValue = observations.at(-2)!.value
        matched =
          rule.operator === "cross_above"
            ? previousValue <= previousAverage && latest.value > currentAverage
            : previousValue >= previousAverage && latest.value < currentAverage
        actual = {
          previousValue,
          previousAverage,
          value: latest.value,
          average: currentAverage,
        }
      } else {
        matched = compare(latest.value, rule.operator, currentAverage)
      }

      return {
        kind: "rule",
        id: rule.id,
        matched,
        skipped: false,
        description: describeRule(rule),
        actual,
        expected: { operator: rule.operator, movingAverageWindow: window },
      }
    }
  }
}

export function evaluateGroup(
  group: ConditionGroupNode,
  observations: ObservationsByIndicator
): GroupEvaluation {
  const children = group.children.map((child) =>
    child.kind === "group"
      ? evaluateGroup(child, observations)
      : evaluateRule(child, observations[child.indicatorId] ?? [])
  )
  const participating = children.filter((child) => !child.skipped)

  // Disabled rules are excluded. Empty/all-disabled groups fail closed.
  const matched =
    participating.length === 0
      ? false
      : group.operator === "and"
        ? participating.every((child) => child.matched)
        : participating.some((child) => child.matched)

  return {
    kind: "group",
    id: group.id,
    operator: group.operator,
    matched,
    skipped: false,
    description: describeGroup(group),
    reason:
      participating.length === 0
        ? "A group with no enabled children evaluates to false."
        : undefined,
    children,
  }
}

export function evaluateCondition(
  input: unknown,
  observations: ObservationsByIndicator
): ConditionEvaluation {
  const validation = validateConditionTree(input)
  if (!validation.success || !validation.tree) {
    return {
      conditionId:
        typeof input === "object" && input && "id" in input
          ? String(input.id)
          : "invalid-condition",
      matched: false,
      description: "Invalid condition",
      evaluatedAt: new Date().toISOString(),
      valid: false,
      errors: validation.errors,
    }
  }

  const tree = validation.tree as ConditionTree
  const root = evaluateGroup(tree.root, observations)
  return {
    conditionId: tree.id,
    matched: tree.enabled && root.matched,
    description: describeGroup(tree.root),
    evaluatedAt: new Date().toISOString(),
    valid: true,
    errors: [],
    root,
  }
}
