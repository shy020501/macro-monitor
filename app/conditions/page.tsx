import { connection } from "next/server"

import { ConditionBuilder } from "@/components/conditions/condition-builder"
import { Badge } from "@/components/ui/badge"
import { groupObservationsByIndicator } from "@/lib/domain/indicators"
import { getConditionTrees } from "@/lib/repositories/conditions"
import { getIndicators } from "@/lib/repositories/indicators"
import { getObservationRequirements } from "@/lib/rules/observation-requirements"

const DEFAULT_BUILDER_OBSERVATION_LIMIT = 121

export default async function ConditionsPage() {
  await connection()
  const conditions = await getConditionTrees()
  const indicators = await getIndicators({
    defaultObservationLimit: DEFAULT_BUILDER_OBSERVATION_LIMIT,
    observationLimits: getObservationRequirements(conditions),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Signal design</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Composite Conditions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Build nested AND/OR groups, validate every rule, and evaluate against local data.</p>
        </div>
        <Badge variant="outline" className="h-7 px-3">{conditions.length} saved condition{conditions.length === 1 ? "" : "s"}</Badge>
      </div>
      <ConditionBuilder
        initialConditions={conditions}
        indicators={indicators.map(({ id, symbol, name }) => ({ id, symbol, name }))}
        observations={groupObservationsByIndicator(indicators)}
      />
    </div>
  )
}
