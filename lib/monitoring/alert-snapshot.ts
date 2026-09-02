import type {
  ConditionNode,
  ConditionTree,
} from "@/lib/domain/conditions"
import type { JsonObject, ObservationsByIndicator } from "@/lib/domain/indicators"
import type {
  GroupEvaluation,
  RuleEvaluation,
} from "@/lib/rules/engine"

const MAX_ARRAY_ITEMS = 10
const MAX_OBJECT_KEYS = 30
const MAX_DEPTH = 4

function compactValue(value: unknown, depth = 0): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }
  if (depth >= MAX_DEPTH) return "[truncated]"

  if (Array.isArray(value)) {
    if (value.length <= MAX_ARRAY_ITEMS) {
      return value.map((item) => compactValue(item, depth + 1))
    }
    return {
      count: value.length,
      first: value
        .slice(0, MAX_ARRAY_ITEMS / 2)
        .map((item) => compactValue(item, depth + 1)),
      last: value
        .slice(-MAX_ARRAY_ITEMS / 2)
        .map((item) => compactValue(item, depth + 1)),
    }
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, MAX_OBJECT_KEYS)
        .map(([key, item]) => [key, compactValue(item, depth + 1)])
    )
  }

  return String(value)
}

function flattenRuleEvaluations(
  node: GroupEvaluation | RuleEvaluation,
  rules: JsonObject[]
): void {
  if (node.kind === "group") {
    node.children.forEach((child) => flattenRuleEvaluations(child, rules))
    return
  }

  rules.push({
    rule_id: node.id,
    matched: node.matched,
    skipped: node.skipped,
    description: node.description,
    actual: compactValue(node.actual),
    expected: compactValue(node.expected),
    ...(node.reason ? { reason: node.reason } : {}),
  })
}

function collectIndicatorSymbols(
  node: ConditionNode,
  symbols: Map<string, string>
): void {
  if (node.kind === "group") {
    node.children.forEach((child) => collectIndicatorSymbols(child, symbols))
  } else if (node.enabled) {
    symbols.set(node.indicatorId, node.indicatorSymbol)
  }
}

export function createAlertPayload(
  condition: ConditionTree,
  evaluation: {
    matched: boolean
    description: string
    evaluatedAt: string
    root?: GroupEvaluation
  },
  observations: ObservationsByIndicator
): JsonObject {
  const rules: JsonObject[] = []
  if (evaluation.root) flattenRuleEvaluations(evaluation.root, rules)

  const symbols = new Map<string, string>()
  collectIndicatorSymbols(condition.root, symbols)
  const indicatorTimestamps = Object.fromEntries(
    [...symbols].map(([indicatorId, symbol]) => {
      const latest = observations[indicatorId]?.at(-1)
      return [
        symbol,
        {
          indicator_id: indicatorId,
          observed_at: latest?.observedAt ?? null,
        },
      ]
    })
  )

  return {
    condition_name: condition.name,
    condition_snapshot: {
      id: condition.id,
      enabled: condition.enabled,
      root: condition.root,
    },
    evaluation: {
      matched: evaluation.matched,
      description: evaluation.description,
      evaluated_at: evaluation.evaluatedAt,
      rules,
    },
    triggered_by: "monitor",
    indicator_timestamps: indicatorTimestamps,
  }
}
