"use client";

import React, { useMemo } from "react";
import {
  Copy,
  GitBranch,
  Plus,
  TriangleAlert,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { ModalOverlay } from "~/components/ui/ModalOverlay";
import { CustomSelect } from "~/components/ui/CustomSelect";
import {
  MULTI_VALUE_OPERATORS,
  VALUELESS_OPERATORS,
  type FlowCondition,
  type FlowRule,
  type LogicAction,
  type LogicMatch,
  type LogicOperator,
} from "~/lib/form-flow";
import {
  ACTION_LABELS,
  OPERATOR_LABELS,
  choicesForField,
  describeRule,
  lintFlow,
  operatorsForFieldType,
  type FlowIssue,
  type FlowLabels,
} from "~/lib/form-logic";
import type { Flow } from "~/lib/form-flow";

export interface LogicDialogProps {
  open: boolean;
  onClose: () => void;

  triggerFieldId: string;
  triggerFieldLabel: string;

  flow: Flow;
  labels: FlowLabels;

  rules: FlowRule[];
  onAddRule: () => void;
  onUpdateRule: (ruleId: string, patch: Partial<FlowRule>) => void;
  onDuplicateRule: (ruleId: string) => void;
  onMoveRule: (ruleId: string, direction: "up" | "down") => void;
  onDeleteRule: (ruleId: string) => void;

  onAddCondition: (ruleId: string) => void;
  onUpdateCondition: (ruleId: string, conditionId: string, patch: Partial<FlowCondition>) => void;
  onDeleteCondition: (ruleId: string, conditionId: string) => void;
}

const CONTROL = "cf-input h-9 px-2.5 text-[13px]";

export function LogicDialog({
  open,
  onClose,
  triggerFieldId,
  triggerFieldLabel,
  flow,
  labels,
  rules,
  onAddRule,
  onUpdateRule,
  onDuplicateRule,
  onMoveRule,
  onDeleteRule,
  onAddCondition,
  onUpdateCondition,
  onDeleteCondition,
}: LogicDialogProps) {
  const issues = useMemo(() => (open ? lintFlow(flow, labels) : []), [open, flow, labels]);
  const issuesByRule = useMemo(() => {
    const map = new Map<string, FlowIssue[]>();
    for (const issue of issues) {
      if (!issue.ruleId) continue;
      const list = map.get(issue.ruleId);
      if (list) list.push(issue);
      else map.set(issue.ruleId, [issue]);
    }
    return map;
  }, [issues]);

  const formIssues = issues.filter((i) => !i.ruleId);

  if (!open) return null;

  const questionOptions = flow.order.map((field, i) => ({
    id: field.id,
    label: `${i + 1}. ${field.label?.trim() || `Untitled ${field.type.replace("_", " ").toLowerCase()}`}`,
  }));
  const segmentOptions = flow.segments.map((segment, i) => ({
    id: segment.id,
    label: `${i + 1}. ${segment.title?.trim() || `Segment ${i + 1}`}`,
  }));

  return (
    <ModalOverlay onDismiss={onClose}>
      <div className="cf-dialog max-h-[90vh] max-w-4xl">
        <div className="cf-dialog-bar">
          <span className="inline-flex min-w-0 items-center gap-2">
            <GitBranch className="size-3.5 shrink-0 text-(--cf-orange)" />
            <span className="truncate">
              Branching after <strong className="font-semibold">{triggerFieldLabel}</strong>
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-[10px] tracking-wider text-(--cf-ink-soft) uppercase">
              {rules.length} {rules.length === 1 ? "branch" : "branches"}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="cf-btn-outline size-7"
              aria-label="Close branching editor"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="cf-dialog-body space-y-4">
          <p className="text-[12.5px] leading-relaxed text-(--cf-ink-soft)">
            Branches are checked top to bottom after this question is answered. The first one that
            decides wins. A branch with an <em>otherwise</em> always decides; one without it steps
            aside when its conditions don&apos;t hold, and the next branch gets a turn.
          </p>

          {formIssues.length > 0 && <IssueList issues={formIssues} title="Worth checking" />}

          {rules.length === 0 ? (
            <div className="border border-dashed border-(--cf-line-strong) bg-(--cf-cream-2) p-8 text-center">
              <p className="cf-meta">No branches yet</p>
              <h3 className="cf-display mt-3 text-[22px] leading-tight">
                Send people different ways
              </h3>
              <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-(--cf-ink-soft)">
                Add a branch to route on the answers so far — one or more conditions, a place to go
                when they hold, and another when they don&apos;t.
              </p>
            </div>
          ) : (
            rules.map((rule, idx) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                position={idx + 1}
                isFirst={idx === 0}
                isLast={idx === rules.length - 1}
                triggerFieldId={triggerFieldId}
                flow={flow}
                labels={labels}
                questionOptions={questionOptions}
                segmentOptions={segmentOptions}
                issues={issuesByRule.get(rule.id) ?? []}
                onUpdateRule={onUpdateRule}
                onDuplicateRule={onDuplicateRule}
                onMoveRule={onMoveRule}
                onDeleteRule={onDeleteRule}
                onAddCondition={onAddCondition}
                onUpdateCondition={onUpdateCondition}
                onDeleteCondition={onDeleteCondition}
              />
            ))
          )}

          <button
            type="button"
            onClick={onAddRule}
            className="cf-btn cf-press h-10 w-full text-[13px]"
          >
            <Plus className="size-4" />
            Add branch
          </button>
        </div>

        <div className="cf-dialog-foot">
          <span>If no branch decides, the next question follows in order.</span>
          <button
            type="button"
            onClick={onClose}
            className="cf-btn cf-raised cf-press h-9 px-5 text-[13px]"
          >
            Done
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ─── issues ─────────────────────────────────────────────────────────── */

function IssueList({ issues, title }: { issues: FlowIssue[]; title?: string }) {
  return (
    <div
      className="space-y-1.5 border p-3"
      style={{ borderColor: "var(--cf-orange)", background: "var(--cf-cream-2)" }}
    >
      {title && <p className="cf-meta">{title}</p>}
      {issues.map((issue, i) => (
        <p
          key={i}
          className="inline-flex items-start gap-1.5 text-[12px] leading-relaxed"
          style={{ color: issue.level === "error" ? "#b3261e" : "var(--cf-orange)" }}
        >
          <TriangleAlert className="mt-px size-3 shrink-0" />
          <span>{issue.message}</span>
        </p>
      ))}
    </div>
  );
}

/* ─── one branch ─────────────────────────────────────────────────────── */

function RuleCard({
  rule,
  position,
  isFirst,
  isLast,
  triggerFieldId,
  flow,
  labels,
  questionOptions,
  segmentOptions,
  issues,
  onUpdateRule,
  onDuplicateRule,
  onMoveRule,
  onDeleteRule,
  onAddCondition,
  onUpdateCondition,
  onDeleteCondition,
}: {
  rule: FlowRule;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  triggerFieldId: string;
  flow: Flow;
  labels: FlowLabels;
  questionOptions: Array<{ id: string; label: string }>;
  segmentOptions: Array<{ id: string; label: string }>;
  issues: FlowIssue[];
} & Pick<
  LogicDialogProps,
  | "onUpdateRule"
  | "onDuplicateRule"
  | "onMoveRule"
  | "onDeleteRule"
  | "onAddCondition"
  | "onUpdateCondition"
  | "onDeleteCondition"
>) {
  const summary = describeRule(rule, labels);

  return (
    <div
      className="border-2"
      style={{ borderColor: "var(--cf-line-strong)", background: "var(--cf-cream-2)" }}
    >
      {/* header */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2"
        style={{ borderBottomColor: "var(--cf-line)", background: "var(--cf-cream)" }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-(--cf-ink-soft) uppercase">
            Branch {position}
          </span>
          <MatchToggle
            value={rule.match}
            onChange={(match) => onUpdateRule(rule.id, { match })}
            disabled={rule.conditions.length < 2}
          />
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            label={`Move branch ${position} up`}
            disabled={isFirst}
            onClick={() => onMoveRule(rule.id, "up")}
          >
            <ChevronUp className="size-3.5" />
          </IconButton>
          <IconButton
            label={`Move branch ${position} down`}
            disabled={isLast}
            onClick={() => onMoveRule(rule.id, "down")}
          >
            <ChevronDown className="size-3.5" />
          </IconButton>
          <IconButton
            label={`Duplicate branch ${position}`}
            onClick={() => onDuplicateRule(rule.id)}
          >
            <Copy className="size-3.5" />
          </IconButton>
          <IconButton
            label={`Delete branch ${position}`}
            danger
            onClick={() => onDeleteRule(rule.id)}
          >
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {/* conditions */}
        <div className="space-y-2">
          {rule.conditions.length === 0 && (
            <p className="text-[12px] text-(--cf-ink-soft)">
              Add at least one condition — a branch with none never runs.
            </p>
          )}

          {rule.conditions.map((condition, i) => (
            <ConditionRow
              key={condition.id}
              condition={condition}
              lead={i === 0 ? "If" : rule.match === "ANY" ? "or" : "and"}
              flow={flow}
              questionOptions={questionOptions}
              canDelete={rule.conditions.length > 1}
              onChange={(patch) => onUpdateCondition(rule.id, condition.id, patch)}
              onDelete={() => onDeleteCondition(rule.id, condition.id)}
            />
          ))}

          <button
            type="button"
            onClick={() => onAddCondition(rule.id)}
            className="cf-add-dashed w-full cursor-pointer border border-dashed py-1.5 text-[12px]"
          >
            + Add condition
          </button>
        </div>

        {/* outcomes */}
        <div className="grid gap-2 sm:grid-cols-2">
          <Outcome
            heading="Then"
            hint="when the conditions hold"
            action={rule.action}
            targetFieldId={rule.targetFieldId}
            targetSegmentId={rule.targetSegmentId}
            questionOptions={questionOptions.filter((o) => o.id !== triggerFieldId)}
            segmentOptions={segmentOptions}
            onChange={(patch) => onUpdateRule(rule.id, patch)}
            keys={{
              action: "action",
              field: "targetFieldId",
              segment: "targetSegmentId",
            }}
          />
          <Outcome
            heading="Otherwise"
            hint="when they don't"
            action={rule.elseAction ?? null}
            targetFieldId={rule.elseTargetFieldId}
            targetSegmentId={rule.elseTargetSegmentId}
            questionOptions={questionOptions.filter((o) => o.id !== triggerFieldId)}
            segmentOptions={segmentOptions}
            allowNone
            onChange={(patch) => onUpdateRule(rule.id, patch)}
            keys={{
              action: "elseAction",
              field: "elseTargetFieldId",
              segment: "elseTargetSegmentId",
            }}
          />
        </div>

        {/* live sentence — the same text the inspector shows */}
        <p
          className="border-l-2 pl-2.5 text-[12px] leading-relaxed text-(--cf-ink-soft)"
          style={{ borderLeftColor: "var(--cf-orange)" }}
        >
          {summary}
        </p>

        {issues.length > 0 && <IssueList issues={issues} />}
      </div>
    </div>
  );
}

/* ─── controls ───────────────────────────────────────────────────────── */

function IconButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex size-7 cursor-pointer items-center justify-center border border-(--cf-line-strong) bg-(--cf-cream) text-(--cf-ink-soft) transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        danger ? "hover:border-red-500 hover:text-red-600" : "hover:text-(--cf-ink)"
      }`}
    >
      {children}
    </button>
  );
}

function MatchToggle({
  value,
  onChange,
  disabled,
}: {
  value: LogicMatch;
  onChange: (v: LogicMatch) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="inline-flex border"
      style={{ borderColor: "var(--cf-line-strong)", opacity: disabled ? 0.45 : 1 }}
      role="group"
      aria-label="Combine conditions with"
    >
      {(["ALL", "ANY"] as LogicMatch[]).map((option) => {
        const on = value === option;
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(option)}
            className="cursor-pointer px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase transition-colors disabled:cursor-not-allowed"
            style={
              on
                ? { background: "var(--cf-ink)", color: "var(--cf-cream)" }
                : { background: "transparent", color: "var(--cf-ink-soft)" }
            }
          >
            {option === "ALL" ? "match all" : "match any"}
          </button>
        );
      })}
    </div>
  );
}

function ConditionRow({
  condition,
  lead,
  flow,
  questionOptions,
  canDelete,
  onChange,
  onDelete,
}: {
  condition: FlowCondition;
  lead: string;
  flow: Flow;
  questionOptions: Array<{ id: string; label: string }>;
  canDelete: boolean;
  onChange: (patch: Partial<FlowCondition>) => void;
  onDelete: () => void;
}) {
  const sourceField = flow.fieldById.get(condition.fieldId);
  const choices = choicesForField(sourceField);
  const operators = operatorsForFieldType(sourceField?.type);
  const needsValue = !VALUELESS_OPERATORS.includes(condition.operator);
  const isMulti = MULTI_VALUE_OPERATORS.includes(condition.operator);

  return (
    <div
      className="grid gap-2 border p-2 sm:flex sm:flex-wrap sm:items-start"
      style={{ borderColor: "var(--cf-line)", background: "var(--cf-cream)" }}
    >
      <span className="font-mono text-[10px] font-bold tracking-wider text-(--cf-ink-soft) uppercase sm:mt-2 sm:w-8 sm:shrink-0">
        {lead}
      </span>

      <CustomSelect
        value={condition.fieldId}
        onChange={(fieldId) => {
          const next = flow.fieldById.get(fieldId);
          const allowed = operatorsForFieldType(next?.type);
          onChange({
            fieldId,
            ...(allowed.includes(condition.operator)
              ? {}
              : { operator: allowed[0] as LogicOperator, value: null }),
          });
        }}
        options={questionOptions.map((option) => ({
          value: option.id,
          label: option.label,
        }))}
        className="w-full sm:min-w-[160px] sm:flex-1"
      />

      <CustomSelect
        value={condition.operator}
        onChange={(operator) => {
          const wasMulti = MULTI_VALUE_OPERATORS.includes(condition.operator);
          const nowMulti = MULTI_VALUE_OPERATORS.includes(operator);
          onChange({
            operator: operator as LogicOperator,
            ...(VALUELESS_OPERATORS.includes(operator)
              ? { value: null }
              : wasMulti !== nowMulti
                ? { value: nowMulti ? [] : "" }
                : {}),
          });
        }}
        options={operators.map((op) => ({
          value: op,
          label: OPERATOR_LABELS[op],
        }))}
        className="w-full sm:w-auto sm:min-w-[128px]"
      />

      {needsValue && (
        <div className="w-full sm:min-w-40 sm:flex-1">
          <ValueControl
            condition={condition}
            choices={choices}
            fieldType={sourceField?.type}
            isMulti={isMulti}
            onChange={onChange}
          />
        </div>
      )}

      <div className="flex justify-end sm:block">
        <IconButton label="Remove condition" danger disabled={!canDelete} onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

function ValueControl({
  condition,
  choices,
  fieldType,
  isMulti,
  onChange,
}: {
  condition: FlowCondition;
  choices: string[];
  fieldType: string | undefined;
  isMulti: boolean;
  onChange: (patch: Partial<FlowCondition>) => void;
}) {
  if (isMulti) {
    const selected = Array.isArray(condition.value) ? condition.value.map(String) : [];

    if (choices.length > 0) {
      return (
        <div
          className="max-h-28 space-y-1 overflow-y-auto border px-2 py-1.5"
          style={{ borderColor: "var(--cf-line-strong)", background: "#fff" }}
          role="group"
          aria-label="Options to match"
        >
          {choices.map((choice) => {
            const on = selected.some((s) => s.toLowerCase() === choice.toLowerCase());
            return (
              <label
                key={choice}
                className="flex cursor-pointer items-center gap-2 text-[12.5px] text-(--cf-ink)"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    onChange({
                      value: on
                        ? selected.filter((s) => s.toLowerCase() !== choice.toLowerCase())
                        : [...selected, choice],
                    })
                  }
                />
                <span className="truncate">{choice}</span>
              </label>
            );
          })}
        </div>
      );
    }

    return (
      <input
        value={selected.join(", ")}
        onChange={(e) =>
          onChange({
            value: e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        placeholder="value, other value"
        className={CONTROL}
        aria-label="Values to match, comma separated"
      />
    );
  }

  if (fieldType === "TOGGLE") {
    return (
      <CustomSelect
        value={String(condition.value ?? "")}
        onChange={(val) => onChange({ value: val })}
        options={[
          { value: "", label: "Choose…" },
          { value: "true", label: "Yes / on" },
          { value: "false", label: "No / off" },
        ]}
      />
    );
  }

  if (choices.length > 0) {
    return (
      <CustomSelect
        value={String(condition.value ?? "")}
        onChange={(val) => onChange({ value: val })}
        options={[
          { value: "", label: "Choose an answer…" },
          ...choices.map((choice) => ({
            value: choice,
            label: choice,
          })),
        ]}
      />
    );
  }

  const inputType =
    fieldType === "NUMBER" || fieldType === "RATING" || fieldType === "SLIDER"
      ? "number"
      : fieldType === "DATE"
        ? "date"
        : fieldType === "TIME"
          ? "time"
          : "text";

  return (
    <input
      type={inputType}
      value={String(condition.value ?? "")}
      onChange={(e) => onChange({ value: e.target.value })}
      placeholder="value"
      className={CONTROL}
      aria-label="Value"
    />
  );
}

function Outcome({
  heading,
  hint,
  action,
  targetFieldId,
  targetSegmentId,
  questionOptions,
  segmentOptions,
  allowNone,
  onChange,
  keys,
}: {
  heading: string;
  hint: string;
  action: LogicAction | null;
  targetFieldId?: string | null;
  targetSegmentId?: string | null;
  questionOptions: Array<{ id: string; label: string }>;
  segmentOptions: Array<{ id: string; label: string }>;
  allowNone?: boolean;
  onChange: (patch: Partial<FlowRule>) => void;
  keys: { action: keyof FlowRule; field: keyof FlowRule; segment: keyof FlowRule };
}) {
  const set = (patch: Record<string, unknown>) => onChange(patch as Partial<FlowRule>);

  return (
    <div
      className="space-y-2 border p-2.5"
      style={{ borderColor: "var(--cf-line)", background: "var(--cf-cream)" }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-(--cf-ink) uppercase">
          {heading}
        </span>
        <span className="text-[11px] text-(--cf-ink-soft)">{hint}</span>
      </div>

      <CustomSelect
        value={action ?? ""}
        onChange={(val) => {
          const next = (val || null) as LogicAction | null;
          set({
            [keys.action]: next,
            [keys.field]: next === "JUMP_TO_FIELD" ? (targetFieldId ?? null) : null,
            [keys.segment]: next === "JUMP_TO_SEGMENT" ? (targetSegmentId ?? null) : null,
          });
        }}
        options={[
          ...(allowNone ? [{ value: "", label: "Nothing — try the next branch" }] : []),
          ...(Object.keys(ACTION_LABELS) as LogicAction[]).map((option) => ({
            value: option,
            label: ACTION_LABELS[option],
          })),
        ]}
      />

      {action === "JUMP_TO_FIELD" && (
        <CustomSelect
          value={targetFieldId ?? ""}
          onChange={(val) => set({ [keys.field]: val || null })}
          options={[
            { value: "", label: "Choose a question…" },
            ...questionOptions.map((option) => ({
              value: option.id,
              label: option.label,
            })),
          ]}
        />
      )}

      {action === "JUMP_TO_SEGMENT" && (
        <CustomSelect
          value={targetSegmentId ?? ""}
          onChange={(val) => set({ [keys.segment]: val || null })}
          options={[
            { value: "", label: "Choose a segment…" },
            ...(segmentOptions.length === 0 ? [{ value: "", label: "No segments yet" }] : []),
            ...segmentOptions.map((option) => ({
              value: option.id,
              label: option.label,
            })),
          ]}
        />
      )}
    </div>
  );
}
