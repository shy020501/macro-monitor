"use client"

import { Brackets, Plus, Trash2 } from "lucide-react"

import { RuleEditor, OptionSelect } from "@/components/conditions/rule-editor"
import { Button } from "@/components/ui/button"
import type {
  ConditionGroupNode,
  ConditionRuleNode,
  IndicatorOption,
} from "@/lib/domain/conditions"
import { createRule } from "@/lib/domain/conditions"
import { cn } from "@/lib/utils"

interface NamedIndicator extends IndicatorOption {
  name: string
}

interface GroupEditorProps {
  group: ConditionGroupNode
  indicators: NamedIndicator[]
  isRoot?: boolean
  depth?: number
  onGroupChange: (groupId: string, group: ConditionGroupNode) => void
  onRuleChange: (ruleId: string, rule: ConditionRuleNode) => void
  onDeleteNode: (nodeId: string) => void
  onAddRule: (groupId: string, rule: ConditionRuleNode) => void
  onAddGroup: (groupId: string, group: ConditionGroupNode) => void
}

export function GroupEditor({
  group,
  indicators,
  isRoot = false,
  depth = 0,
  onGroupChange,
  onRuleChange,
  onDeleteNode,
  onAddRule,
  onAddGroup,
}: GroupEditorProps) {
  const firstIndicator = indicators[0]

  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border p-3 sm:p-4",
        isRoot ? "bg-muted/30" : "bg-background shadow-xs",
        depth > 0 && "border-l-4 border-l-foreground/25"
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
            <Brackets className="size-3.5" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isRoot ? "Root group" : `Nested group · level ${depth}`}
          </span>
          <OptionSelect
            value={group.operator}
            onChange={(operator) =>
              onGroupChange(group.id, {
                ...group,
                operator: operator as "and" | "or",
              })
            }
            options={[
              { value: "and", label: "AND" },
              { value: "or", label: "OR" },
            ]}
            ariaLabel="Group operator"
            className="w-24"
          />
        </div>
        {!isRoot && (
          <Button variant="ghost" size="sm" onClick={() => onDeleteNode(group.id)}>
            <Trash2 /> Delete group
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {group.children.map((child) =>
          child.kind === "group" ? (
            <GroupEditor
              key={child.id}
              group={child}
              indicators={indicators}
              depth={depth + 1}
              onGroupChange={onGroupChange}
              onRuleChange={onRuleChange}
              onDeleteNode={onDeleteNode}
              onAddRule={onAddRule}
              onAddGroup={onAddGroup}
            />
          ) : (
            <RuleEditor
              key={child.id}
              rule={child}
              indicators={indicators}
              onChange={(rule) => onRuleChange(child.id, rule)}
              onDelete={() => onDeleteNode(child.id)}
            />
          )
        )}
        {group.children.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Empty groups cannot be saved. Add a rule or nested group.
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!firstIndicator}
          onClick={() => firstIndicator && onAddRule(group.id, createRule("threshold", firstIndicator))}
        >
          <Plus /> Add rule
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!firstIndicator}
          onClick={() => {
            if (!firstIndicator) return
            onAddGroup(group.id, {
              kind: "group",
              id: crypto.randomUUID(),
              operator: group.operator === "and" ? "or" : "and",
              children: [createRule("threshold", firstIndicator)],
            })
          }}
        >
          <Plus /> Add nested group
        </Button>
      </div>
    </div>
  )
}
