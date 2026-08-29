import { CheckCircle2, CircleOff, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { GroupEvaluation, RuleEvaluation } from "@/lib/rules/engine"

function ResultBadge({ result }: { result: GroupEvaluation | RuleEvaluation }) {
  if (result.skipped) {
    return <Badge variant="outline" className="gap-1"><CircleOff />Skipped</Badge>
  }
  return (
    <Badge variant={result.matched ? "default" : "secondary"} className="gap-1">
      {result.matched ? <CheckCircle2 /> : <XCircle />}
      {result.matched ? "True" : "False"}
    </Badge>
  )
}

export function EvaluationDetail({ result }: { result: GroupEvaluation | RuleEvaluation }) {
  if (result.kind === "rule") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">{result.description}</p>
          {result.reason && <p className="mt-1 text-xs text-muted-foreground">{result.reason}</p>}
        </div>
        <ResultBadge result={result} />
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {result.operator} group
        </p>
        <ResultBadge result={result} />
      </div>
      {result.reason && <p className="mb-3 text-xs text-muted-foreground">{result.reason}</p>}
      <div className="space-y-2 border-l pl-3">
        {result.children.map((child) => <EvaluationDetail key={child.id} result={child} />)}
      </div>
    </div>
  )
}
