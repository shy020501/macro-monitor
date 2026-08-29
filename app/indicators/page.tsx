import { connection } from "next/server"

import { IndicatorsExplorer } from "@/components/indicators/indicators-explorer"
import { Badge } from "@/components/ui/badge"
import { getIndicators } from "@/lib/repositories/indicators"

export default async function IndicatorsPage() {
  await connection()
  const indicators = await getIndicators()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Market data</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Indicators</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inspect the seeded economic time series and their latest movement.</p>
        </div>
        <Badge variant="outline" className="h-7 px-3">{indicators.length} tracked series</Badge>
      </div>
      <IndicatorsExplorer indicators={indicators} />
    </div>
  )
}
