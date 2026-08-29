"use client"

import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { ConditionRuleNode, RuleType } from "@/lib/domain/conditions"
import { createRule, type IndicatorOption } from "@/lib/domain/conditions"

interface NamedIndicator extends IndicatorOption {
  name: string
}

interface OptionSelectProps {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string; triggerLabel?: string }>
  ariaLabel: string
  className?: string
  contentClassName?: string
}

export function OptionSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  contentClassName,
}: OptionSelectProps) {
  const selectedOption = options.find((option) => option.value === value)

  return (
    <Select
      value={value}
      items={options}
      onValueChange={(next) => next && onChange(String(next))}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={className ?? "w-full min-w-0"}
      >
        <SelectValue>
          {selectedOption?.triggerLabel ?? selectedOption?.label ?? value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" className={contentClassName}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const ruleTypes: Array<{ value: RuleType; label: string }> = [
  { value: "threshold", label: "Value threshold" },
  { value: "percentage_change", label: "Percentage change" },
  { value: "streak", label: "Consecutive streak" },
  { value: "streak_break", label: "Streak break" },
  { value: "moving_average", label: "Moving average" },
]

const comparisons = [
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "eq", label: "=" },
]

const directions = [
  { value: "increasing", label: "Increasing" },
  { value: "decreasing", label: "Decreasing" },
]

function NumberField({
  value,
  onChange,
  label,
  suffix,
  min,
}: {
  value: number
  onChange: (value: number) => void
  label: string
  suffix?: string
  min?: number
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <Input
          type="number"
          value={value}
          min={min}
          step="any"
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 font-mono"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  )
}

function RuleField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

export function RuleEditor({
  rule,
  indicators,
  onChange,
  onDelete,
}: {
  rule: ConditionRuleNode
  indicators: NamedIndicator[]
  onChange: (rule: ConditionRuleNode) => void
  onDelete: () => void
}) {
  const changeRuleType = (ruleType: RuleType) => {
    const indicator = indicators.find(({ id }) => id === rule.indicatorId) ?? indicators[0]
    if (!indicator) return
    const next = createRule(ruleType, indicator)
    onChange({ ...next, id: rule.id, enabled: rule.enabled })
  }

  const parameterFields = (() => {
    switch (rule.ruleType) {
      case "threshold":
        return (
          <>
            <RuleField label="Operator">
              <OptionSelect
                value={rule.operator}
                onChange={(operator) => onChange({ ...rule, operator: operator as typeof rule.operator })}
                options={comparisons}
                ariaLabel="Threshold comparison"
              />
            </RuleField>
            <NumberField
              label="Target value"
              value={rule.parameters.value}
              onChange={(value) => onChange({ ...rule, parameters: { value } })}
            />
          </>
        )
      case "percentage_change":
        return (
          <>
            <RuleField label="Operator">
              <OptionSelect
                value={rule.operator}
                onChange={(operator) => onChange({ ...rule, operator: operator as typeof rule.operator })}
                options={comparisons}
                ariaLabel="Percentage comparison"
              />
            </RuleField>
            <NumberField
              label="Threshold"
              value={rule.parameters.threshold}
              suffix="%"
              onChange={(threshold) => onChange({ ...rule, parameters: { ...rule.parameters, threshold } })}
            />
            <NumberField
              label="Lookback"
              value={rule.parameters.window}
              min={1}
              suffix="obs"
              onChange={(window) => onChange({ ...rule, parameters: { ...rule.parameters, window } })}
            />
          </>
        )
      case "streak":
      case "streak_break":
        return (
          <>
            <RuleField label="Direction">
              <OptionSelect
                value={rule.operator}
                onChange={(operator) => onChange({ ...rule, operator: operator as typeof rule.operator })}
                options={directions}
                ariaLabel="Streak direction"
              />
            </RuleField>
            <NumberField
              label="Periods"
              value={rule.parameters.periods}
              min={1}
              suffix="moves"
              onChange={(periods) => onChange({ ...rule, parameters: { ...rule.parameters, periods } })}
            />
          </>
        )
      case "moving_average":
        return (
          <>
            <RuleField label="Operator">
              <OptionSelect
                value={rule.operator}
                onChange={(operator) => onChange({ ...rule, operator: operator as typeof rule.operator })}
                options={[
                  { value: "gt", label: ">" },
                  { value: "gte", label: "≥" },
                  { value: "lt", label: "<" },
                  { value: "lte", label: "≤" },
                  { value: "cross_above", label: "Cross above" },
                  { value: "cross_below", label: "Cross below" },
                ]}
                ariaLabel="Moving average comparison"
              />
            </RuleField>
            <NumberField
              label="MA window"
              value={rule.parameters.window}
              min={2}
              suffix="obs"
              onChange={(window) => onChange({ ...rule, parameters: { window } })}
            />
          </>
        )
    }
  })()

  return (
    <div className="min-w-0 rounded-lg border bg-background p-3 shadow-xs">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={rule.enabled}
            onCheckedChange={(enabled) => onChange({ ...rule, enabled })}
            aria-label="Toggle rule"
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {rule.enabled ? "Rule" : "Rule disabled"}
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete rule">
          <Trash2 />
        </Button>
      </div>
      <div
        className="grid min-w-0 gap-2"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 9rem), 1fr))",
        }}
      >
        <RuleField label="Indicator">
          <OptionSelect
            value={rule.indicatorId}
            onChange={(indicatorId) => {
              const indicator = indicators.find(({ id }) => id === indicatorId)
              if (indicator) onChange({ ...rule, indicatorId, indicatorSymbol: indicator.symbol })
            }}
            options={indicators.map(({ id, symbol, name }) => ({
              value: id,
              label: `${symbol} · ${name}`,
              triggerLabel: symbol,
            }))}
            ariaLabel="Indicator"
            contentClassName="w-80 max-w-[calc(100vw-2rem)]"
          />
        </RuleField>
        <RuleField label="Rule type">
          <OptionSelect
            value={rule.ruleType}
            onChange={(ruleType) => changeRuleType(ruleType as RuleType)}
            options={ruleTypes}
            ariaLabel="Rule type"
          />
        </RuleField>
        {parameterFields}
      </div>
    </div>
  )
}
