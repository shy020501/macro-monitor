import type { ConditionTree } from "@/lib/domain/conditions"

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    )
  }
  return value
}

export function conditionRulesAreEqual(
  left: ConditionTree,
  right: ConditionTree
): boolean {
  return (
    JSON.stringify(canonicalize(left.root)) ===
    JSON.stringify(canonicalize(right.root))
  )
}
