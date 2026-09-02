"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  CopyPlus,
  Save,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react"

import {
  deleteConditionAction,
  saveConditionAction,
} from "@/app/conditions/actions"
import { EvaluationDetail } from "@/components/conditions/evaluation-detail"
import { GroupEditor } from "@/components/conditions/group-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  addChild,
  removeNode,
  updateGroup,
  updateRule,
} from "@/lib/conditions/tree-operations"
import type {
  ConditionGroupNode,
  ConditionRuleNode,
  ConditionTree,
  IndicatorOption,
} from "@/lib/domain/conditions"
import { createConditionTree, validateConditionTree } from "@/lib/domain/conditions"
import type {
  Observation,
  ObservationsByIndicator,
} from "@/lib/domain/indicators"
import { evaluateCondition } from "@/lib/rules/engine"
import { getObservationRequirements } from "@/lib/rules/observation-requirements"
import { cn } from "@/lib/utils"

interface NamedIndicator extends IndicatorOption {
  name: string
}

interface ObservationResponse {
  observations?: Observation[]
  error?: string
}

function cloneTree(tree: ConditionTree): ConditionTree {
  return structuredClone(tree)
}

function ConditionSetSidebar({
  conditions,
  selectedId,
  evaluations,
  isPending,
  onNew,
  onSelect,
  onDelete,
}: {
  conditions: ConditionTree[]
  selectedId?: string
  evaluations: Map<string, { matched: boolean }>
  isPending: boolean
  onNew: () => void
  onSelect: (condition: ConditionTree) => void
  onDelete: (condition: ConditionTree) => void
}) {
  return (
    <Card className="h-fit xl:sticky xl:top-8">
      <CardHeader className="border-b">
        <CardTitle>Condition sets</CardTitle>
        <CardDescription>Select a condition or start fresh.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onNew}
        >
          <CopyPlus /> New condition
        </Button>
        <div className="space-y-2 border-t pt-3">
          {conditions.length === 0 && (
            <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
              No saved conditions.
            </div>
          )}
          {conditions.map((condition) => {
            const result = evaluations.get(condition.id)
            const selected = selectedId === condition.id
            return (
              <div
                key={condition.id}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/70",
                  selected && "border-foreground bg-muted"
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelect(condition)}
                >
                  <span className="line-clamp-2 text-sm font-medium">
                    {condition.name}
                  </span>
                  <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        result?.matched
                          ? "bg-emerald-500"
                          : "bg-muted-foreground/40"
                      )}
                    />
                    {condition.enabled ? "Enabled" : "Disabled"} ·{" "}
                    {result?.matched ? "True" : "False"}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  disabled={isPending}
                  onClick={() => onDelete(condition)}
                  aria-label={`Delete ${condition.name}`}
                  title="Delete condition"
                >
                  <Trash2 />
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function ConditionBuilder({
  initialConditions,
  indicators,
  observations,
}: {
  initialConditions: ConditionTree[]
  indicators: NamedIndicator[]
  observations: ObservationsByIndicator
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [conditions, setConditions] = useState(initialConditions)
  const [draft, setDraft] = useState<ConditionTree | null>(() =>
    initialConditions[0] ? cloneTree(initialConditions[0]) : null
  )
  const [availableObservations, setAvailableObservations] =
    useState(observations)
  const [observationLoadError, setObservationLoadError] = useState<
    string | null
  >(null)
  const [saveMessage, setSaveMessage] = useState<{ text: string } | null>(null)

  const observationRequirements = useMemo(
    () => getObservationRequirements(draft ? [...conditions, draft] : conditions),
    [conditions, draft]
  )
  const observationRequirementKey = JSON.stringify(observationRequirements)

  useEffect(() => {
    const missing = Object.entries(observationRequirements).filter(
      ([indicatorId, required]) =>
        (availableObservations[indicatorId]?.length ?? 0) < required
    )
    if (missing.length === 0) return

    const controller = new AbortController()

    void Promise.all(
      missing.map(async ([indicatorId, required]) => {
        const response = await fetch(
          `/api/indicators/${encodeURIComponent(indicatorId)}/observations?limit=${required}`,
          { signal: controller.signal, cache: "no-store" }
        )
        const payload = (await response.json()) as ObservationResponse
        if (!response.ok || !payload.observations) {
          throw new Error(payload.error ?? "Unable to load rule observations.")
        }
        return [indicatorId, payload.observations] as const
      })
    )
      .then((entries) => {
        setObservationLoadError(null)
        setAvailableObservations((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }))
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setObservationLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load rule observations."
        )
      })

    return () => controller.abort()
    // The serialized requirement map is the fetch trigger. Observation updates
    // themselves must not repeat a request when a series has less history than
    // a valid rule asks for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observationRequirementKey])

  const validation = useMemo(
    () => (draft ? validateConditionTree(draft) : null),
    [draft]
  )
  const evaluation = useMemo(
    () => (draft ? evaluateCondition(draft, availableObservations) : null),
    [availableObservations, draft]
  )
  const listEvaluations = useMemo(
    () =>
      new Map(
        conditions.map((condition) => [
          condition.id,
          evaluateCondition(condition, availableObservations),
        ])
      ),
    [availableObservations, conditions]
  )
  const firstIndicator = indicators[0]

  const changeRoot = (root: ConditionGroupNode) =>
    setDraft((current) => (current ? { ...current, root } : current))

  const handleNew = () => {
    if (!firstIndicator) return
    setDraft(createConditionTree(firstIndicator))
    setSaveMessage(null)
  }

  const handleSave = () => {
    if (!draft) return
    setSaveMessage(null)
    startTransition(async () => {
      const result = await saveConditionAction(draft)
      if (!result.success) {
        setSaveMessage({
          text: [result.message, ...(result.errors ?? [])].join(" "),
        })
        return
      }
      setConditions((current) => {
        const next = current.filter(({ id }) => id !== draft.id)
        return [...next, cloneTree(draft)]
      })
      setDraft(null)
      setSaveMessage(null)
      router.refresh()
    })
  }

  const handleDelete = (condition: ConditionTree) => {
    const confirmed = window.confirm(
      `Delete "${condition.name}"? Its groups and rules will also be deleted.`
    )
    if (!confirmed) return

    setSaveMessage(null)
    startTransition(async () => {
      const result = await deleteConditionAction(condition.id)
      if (!result.success) {
        setSaveMessage({ text: result.message })
        return
      }

      const remaining = conditions.filter(({ id }) => id !== condition.id)
      setConditions(remaining)
      setDraft(null)
      setSaveMessage(null)
      router.refresh()
    })
  }

  if (indicators.length === 0) {
    return <Card><CardContent className="py-12 text-center">Create an indicator before building conditions.</CardContent></Card>
  }

  const sidebar = (
    <ConditionSetSidebar
      conditions={conditions}
      selectedId={draft?.id}
      evaluations={listEvaluations}
      isPending={isPending}
      onNew={handleNew}
      onSelect={(condition) => {
        setDraft(cloneTree(condition))
        setSaveMessage(null)
      }}
      onDelete={handleDelete}
    />
  )

  if (!draft || !validation || !evaluation) {
    return (
      <div className="grid gap-5 xl:grid-cols-[18.75rem_minmax(0,1fr)]">
        {sidebar}

        <Card className="min-h-80">
          <CardContent className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted">
              <CopyPlus className="size-5 text-muted-foreground" />
            </span>
            <h2 className="font-semibold">
              {conditions.length === 0
                ? "No conditions yet"
                : "Select a condition"}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {conditions.length === 0
                ? "Create a condition to start adding rules."
                : "Choose a saved condition from the list, or start a new one."}
            </p>
            <Button className="mt-5" onClick={handleNew}>
              <CopyPlus /> New condition
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[18.75rem_minmax(0,1fr)_22.5rem]">
      {sidebar}

      <div className="min-w-0 space-y-4">
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Condition details</CardTitle>
                <CardDescription>Name the signal and control whether it is active.</CardDescription>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <Switch
                  checked={draft.enabled}
                  onCheckedChange={(enabled) =>
                    setDraft((current) =>
                      current ? { ...current, enabled } : current
                    )
                  }
                />
                {draft.enabled ? "Enabled" : "Disabled"}
              </label>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Condition name</span>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, name: event.target.value } : current
                  )
                }
                placeholder="e.g. Dollar pressure with high yields"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Description (optional)</span>
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? { ...current, description: event.target.value }
                      : current
                  )
                }
                placeholder="Explain what this signal is intended to detect."
                className="min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
          </CardContent>
        </Card>

        <GroupEditor
          group={draft.root}
          indicators={indicators}
          isRoot
          onGroupChange={(groupId, group) =>
            changeRoot(updateGroup(draft.root, groupId, () => group))
          }
          onRuleChange={(ruleId, rule) =>
            changeRoot(updateRule(draft.root, ruleId, () => rule))
          }
          onDeleteNode={(nodeId) => changeRoot(removeNode(draft.root, nodeId))}
          onAddRule={(groupId, rule: ConditionRuleNode) =>
            changeRoot(addChild(draft.root, groupId, rule))
          }
          onAddGroup={(groupId, group: ConditionGroupNode) =>
            changeRoot(addChild(draft.root, groupId, group))
          }
        />

        {!validation.success && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-medium">Condition not ready to save</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {validation.errors.slice(0, 6).map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Atomic save</p>
            <p className="text-xs text-muted-foreground">The set, groups, and rules are validated then replaced in one DB transaction.</p>
            {saveMessage && (
              <p className="mt-2 text-sm text-destructive">
                {saveMessage.text}
              </p>
            )}
          </div>
          <Button disabled={!validation.success || isPending} onClick={handleSave} size="lg">
            <Save /> {isPending ? "Saving…" : "Save condition"}
          </Button>
        </div>
      </div>

      <Card className="h-fit xl:sticky xl:top-8">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Live evaluation</CardTitle>
              <CardDescription>Computed from current local observations.</CardDescription>
            </div>
            <Badge variant={evaluation.matched ? "default" : "secondary"} className="gap-1">
              {evaluation.matched ? <CheckCircle2 /> : <XCircle />}
              {evaluation.matched ? "True" : "False"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {observationLoadError && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {observationLoadError}
            </div>
          )}
          <div className="mb-4 rounded-lg bg-muted p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Sparkles className="size-3.5" />Human-readable condition</p>
            <p className="mt-2 text-sm leading-relaxed">{evaluation.description || "Add an enabled rule to describe this condition."}</p>
          </div>
          {evaluation.root ? (
            <EvaluationDetail result={evaluation.root} />
          ) : (
            <div className="text-sm text-destructive">{evaluation.errors.join(" ")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
