import "server-only"

import type { JsonObject } from "@/lib/domain/indicators"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export interface AlertRecord {
  id: string
  conditionSetId: string | null
  conditionName: string | null
  triggeredAt: string
  message: string
  payload: JsonObject
}

export async function getRecentAlerts(limit = 8): Promise<AlertRecord[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("alerts")
    .select("id,condition_set_id,triggered_at,message,payload,condition_sets(name)")
    .order("triggered_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const relation = row.condition_sets as
      | { name: string }
      | Array<{ name: string }>
      | null
    const condition = Array.isArray(relation) ? relation[0] : relation
    const payload = (row.payload ?? {}) as JsonObject
    const snapshotName =
      typeof payload.condition_name === "string"
        ? payload.condition_name
        : null
    return {
      id: row.id,
      conditionSetId: row.condition_set_id,
      conditionName: condition?.name ?? snapshotName,
      triggeredAt: row.triggered_at,
      message: row.message,
      payload,
    }
  })
}
