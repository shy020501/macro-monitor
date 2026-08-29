"use client"

import { useMemo, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Database, Minus } from "lucide-react"

import { IndicatorChart } from "@/components/indicators/indicator-chart"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Indicator } from "@/lib/domain/indicators"
import { summarizeIndicator } from "@/lib/domain/indicators"
import { formatNumber, formatSigned, formatTimestamp } from "@/lib/formatters"
import { cn } from "@/lib/utils"

export function IndicatorsExplorer({ indicators }: { indicators: Indicator[] }) {
  const summaries = useMemo(() => indicators.map(summarizeIndicator), [indicators])
  const [selectedId, setSelectedId] = useState(summaries[0]?.id ?? "")
  const selected = summaries.find(({ id }) => id === selectedId) ?? summaries[0]

  if (!selected) {
    return <Card><CardContent className="py-12 text-center">No indicators found.</CardContent></Card>
  }

  const DirectionIcon =
    selected.direction === "up"
      ? ArrowUpRight
      : selected.direction === "down"
        ? ArrowDownRight
        : Minus
  const hasVolume = selected.observations.some(
    (observation) => observation.volume !== null
  )
  const hasBuyVolume = selected.observations.some(
    (observation) => observation.buyVolume !== null
  )

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader className="border-b">
          <CardTitle>Tracked indicators</CardTitle>
          <CardDescription>Select a market series to inspect.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y px-0">
          {summaries.map((indicator) => (
            <button
              key={indicator.id}
              type="button"
              onClick={() => setSelectedId(indicator.id)}
              className={cn(
                "flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/70",
                selected.id === indicator.id && "bg-muted"
              )}
            >
              <span className="min-w-0">
                <span className="block font-medium">{indicator.symbol}</span>
                <span className="block truncate text-xs text-muted-foreground">{indicator.name}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-sm font-medium">{formatNumber(indicator.latest?.value ?? null)}</span>
                <span
                  className={cn(
                    "block text-xs",
                    indicator.direction === "up" && "text-emerald-700",
                    indicator.direction === "down" && "text-rose-700",
                    !["up", "down"].includes(indicator.direction) && "text-muted-foreground"
                  )}
                >
                  {formatSigned(indicator.changePercent, "%")}
                </span>
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl">{selected.symbol}</CardTitle>
                  <Badge variant="secondary">{selected.category}</Badge>
                  <Badge variant="outline">{selected.frequency}</Badge>
                </div>
                <CardDescription>{selected.name}</CardDescription>
              </div>
              <div className="text-left sm:text-right">
                <p className="font-mono text-3xl font-semibold">{formatNumber(selected.latest?.value ?? null)}</p>
                <p className="text-xs text-muted-foreground">{selected.unit}</p>
                <div
                  className={cn(
                    "mt-2 flex items-center gap-1 text-sm font-medium sm:justify-end",
                    selected.direction === "up" && "text-emerald-700",
                    selected.direction === "down" && "text-rose-700",
                    selected.direction === "flat" && "text-muted-foreground"
                  )}
                >
                  <DirectionIcon className="size-4" />
                  {formatSigned(selected.change)} ({formatSigned(selected.changePercent, "%")})
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="chart">
              <TabsList>
                <TabsTrigger value="chart">Chart</TabsTrigger>
                <TabsTrigger value="observations">Observations</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              </TabsList>
              <TabsContent value="chart" className="pt-4">
                <IndicatorChart key={selected.id} indicator={selected} />
              </TabsContent>
              <TabsContent value="observations" className="pt-4">
                <div className="max-h-80 overflow-auto rounded-lg border">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead className="sticky top-0 bg-muted/95 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Observed</th>
                        <th className="px-3 py-2 text-right font-medium">Value</th>
                        <th className="px-3 py-2 text-right font-medium">Open</th>
                        <th className="px-3 py-2 text-right font-medium">High</th>
                        <th className="px-3 py-2 text-right font-medium">Low</th>
                        <th className="px-3 py-2 text-right font-medium">Close</th>
                        {hasVolume && (
                          <th className="px-3 py-2 text-right font-medium">Volume</th>
                        )}
                        {hasBuyVolume && (
                          <th className="px-3 py-2 text-right font-medium">Buy volume</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...selected.observations].reverse().map((observation) => (
                        <tr key={observation.id}>
                          <td className="px-3 py-2">{formatTimestamp(observation.observedAt)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatNumber(observation.value)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatNumber(observation.open)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatNumber(observation.high)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatNumber(observation.low)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatNumber(observation.close)}</td>
                          {hasVolume && (
                            <td className="px-3 py-2 text-right font-mono">{formatNumber(observation.volume, 0)}</td>
                          )}
                          {hasBuyVolume && (
                            <td className="px-3 py-2 text-right font-mono">{formatNumber(observation.buyVolume, 0)}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              <TabsContent value="metadata" className="pt-4">
                <dl className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                  {[
                    ["Symbol", selected.symbol],
                    ["Category", selected.category],
                    ["Source", selected.source],
                    ["Unit", selected.unit],
                    ["Frequency", selected.frequency],
                    ["Last observation", formatTimestamp(selected.latest?.observedAt ?? null)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 font-medium">{value}</dd>
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Metadata JSON</dt>
                    <dd className="mt-1 rounded-md bg-background p-2 font-mono text-xs">{JSON.stringify(selected.metadata)}</dd>
                  </div>
                </dl>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card size="sm"><CardContent><p className="text-xs text-muted-foreground">Latest value</p><p className="mt-1 font-mono text-lg font-semibold">{formatNumber(selected.latest?.value ?? null)}</p></CardContent></Card>
          <Card size="sm"><CardContent><p className="text-xs text-muted-foreground">Daily change</p><p className="mt-1 font-mono text-lg font-semibold">{formatSigned(selected.change)}</p></CardContent></Card>
          <Card size="sm"><CardContent><p className="text-xs text-muted-foreground">Data points</p><p className="mt-1 flex items-center gap-2 text-lg font-semibold"><Database className="size-4" />{selected.observations.length}</p></CardContent></Card>
        </div>
      </div>
    </div>
  )
}
