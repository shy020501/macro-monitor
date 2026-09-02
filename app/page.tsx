import Link from "next/link"
import { connection } from "next/server"
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  CircleDashed,
  Minus,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { groupObservationsByIndicator, summarizeIndicator } from "@/lib/domain/indicators"
import { formatNumber, formatSigned, formatTimestamp } from "@/lib/formatters"
import { getRecentAlerts } from "@/lib/repositories/alerts"
import { getConditionTrees } from "@/lib/repositories/conditions"
import { getIndicators } from "@/lib/repositories/indicators"
import { evaluateCondition } from "@/lib/rules/engine"
import { getObservationRequirements } from "@/lib/rules/observation-requirements"

export default async function DashboardPage() {
  await connection()
  const [conditions, alerts] = await Promise.all([
    getConditionTrees(),
    getRecentAlerts(),
  ])
  const indicators = await getIndicators({
    defaultObservationLimit: 2,
    observationLimits: getObservationRequirements(conditions),
  })
  const summaries = indicators.map(summarizeIndicator)
  const observations = groupObservationsByIndicator(indicators)
  const activeConditions = conditions
    .filter((condition) => condition.enabled)
    .map((condition) => ({
      condition,
      evaluation: evaluateCondition(condition, observations),
    }))

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Market overview
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest local observations and composite signal status.
          </p>
        </div>
        <Badge variant="outline" className="h-7 gap-1.5 px-3">
          <CircleDashed className="size-3.5" /> Local seed data
        </Badge>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Indicator summary</h2>
            <p className="text-sm text-muted-foreground">Daily observations across six tracked markets</p>
          </div>
          <Button variant="ghost" render={<Link href="/indicators" />}>
            Explore indicators <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((indicator) => {
            const DirectionIcon =
              indicator.direction === "up"
                ? ArrowUpRight
                : indicator.direction === "down"
                  ? ArrowDownRight
                  : Minus
            const positive = indicator.direction === "up"
            const negative = indicator.direction === "down"
            return (
              <Card key={indicator.id} className="transition-shadow hover:shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {indicator.symbol}
                        <Badge variant="secondary">{indicator.category}</Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">{indicator.name}</CardDescription>
                    </div>
                    <span
                      className={`flex size-8 items-center justify-center rounded-lg ${
                        positive
                          ? "bg-emerald-500/10 text-emerald-700"
                          : negative
                            ? "bg-rose-500/10 text-rose-700"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <DirectionIcon className="size-4" />
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="font-mono text-2xl font-semibold tracking-tight">
                        {formatNumber(indicator.latest?.value ?? null)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{indicator.unit}</p>
                    </div>
                    <div
                      className={`text-right text-sm font-medium ${
                        positive
                          ? "text-emerald-700"
                          : negative
                            ? "text-rose-700"
                            : "text-muted-foreground"
                      }`}
                    >
                      <p>{formatSigned(indicator.change)}</p>
                      <p>{formatSigned(indicator.changePercent, "%")}</p>
                    </div>
                  </div>
                  <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                    Last updated {formatTimestamp(indicator.latest?.observedAt ?? null)}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Active conditions</h2>
              <p className="text-sm text-muted-foreground">Evaluated against the latest local observations</p>
            </div>
            <Button variant="ghost" render={<Link href="/conditions" />}>
              Open builder <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          <Card>
            <CardContent className="divide-y px-0">
              {activeConditions.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No enabled conditions.
                </div>
              ) : (
                activeConditions.map(({ condition, evaluation }) => (
                  <div key={condition.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{condition.name}</p>
                        <Badge variant="outline">Enabled</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {evaluation.description || "No enabled rules"}
                      </p>
                    </div>
                    <Badge
                      variant={evaluation.matched ? "default" : "secondary"}
                      className="h-7 shrink-0 gap-1.5 px-3"
                    >
                      {evaluation.matched ? <CheckCircle2 /> : <XCircle />}
                      {evaluation.matched ? "True" : "False"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">Recent alerts</h2>
            <p className="text-sm text-muted-foreground">Historical trigger records</p>
          </div>
          <Card className="min-h-48">
            {alerts.length === 0 ? (
              <CardContent className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                  <Bell className="size-4 text-muted-foreground" />
                </span>
                <p className="font-medium">No alerts yet</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Evaluations are visible now; notification delivery is intentionally not connected.
                </p>
              </CardContent>
            ) : (
              <CardContent className="divide-y px-0">
                {alerts.map((alert) => (
                  <div key={alert.id} className="px-4 py-3">
                    <p className="font-medium">{alert.conditionName ?? "Deleted condition"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatTimestamp(alert.triggeredAt)}</p>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </section>
      </div>
    </div>
  )
}
