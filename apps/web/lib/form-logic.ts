import {
  type Flow,
  type FlowRule,
  type FlowCondition,
  type LogicAction,
  type LogicOperator,
  MULTI_VALUE_OPERATORS,
  VALUELESS_OPERATORS,
} from "./form-flow";

/* ─── Vocabulary ──────────────────────────────────────────────────────── */

export const OPERATOR_LABELS: Record<LogicOperator, string> = {
  EQUALS: "is",
  NOT_EQUALS: "is not",
  CONTAINS: "contains",
  NOT_CONTAINS: "does not contain",
  GREATER_THAN: "is more than",
  LESS_THAN: "is less than",
  IS_EMPTY: "is blank",
  IS_NOT_EMPTY: "is answered",
  IS_ANY_OF: "is any of",
  IS_NONE_OF: "is none of",
  STARTS_WITH: "starts with",
  ENDS_WITH: "ends with",
};

export const ACTION_LABELS: Record<LogicAction, string> = {
  JUMP_TO_FIELD: "Go to question",
  JUMP_TO_SEGMENT: "Go to segment",
  SUBMIT: "Finish the form",
  CONTINUE: "Continue in order",
};

export function operatorsForFieldType(type: string | undefined): LogicOperator[] {
  const presence: LogicOperator[] = ["IS_EMPTY", "IS_NOT_EMPTY"];

  switch (type) {
    case "SELECT":
    case "RADIO":
      return ["EQUALS", "NOT_EQUALS", "IS_ANY_OF", "IS_NONE_OF", ...presence];
    case "CHECKBOX":
      return ["CONTAINS", "NOT_CONTAINS", "IS_ANY_OF", "IS_NONE_OF", "EQUALS", ...presence];
    case "NUMBER":
    case "RATING":
    case "SLIDER":
      return ["EQUALS", "NOT_EQUALS", "GREATER_THAN", "LESS_THAN", ...presence];
    case "DATE":
    case "TIME":
    case "DATETIME":
      return ["EQUALS", "NOT_EQUALS", "GREATER_THAN", "LESS_THAN", ...presence];
    case "TOGGLE":
      return ["EQUALS", ...presence];
    default:
      return [
        "EQUALS",
        "NOT_EQUALS",
        "CONTAINS",
        "NOT_CONTAINS",
        "STARTS_WITH",
        "ENDS_WITH",
        "IS_ANY_OF",
        "IS_NONE_OF",
        ...presence,
      ];
  }
}

export function choicesForField(field: { options?: unknown } | undefined): string[] {
  if (!field) return [];
  const options = field.options;
  if (Array.isArray(options)) return options.map(String);
  if (options && typeof options === "object") {
    const choices = (options as { choices?: unknown }).choices;
    if (Array.isArray(choices)) return choices.map(String);
  }
  return [];
}

/* ─── Describing ──────────────────────────────────────────────────────── */

export interface FlowLabels {
  fieldLabel: (fieldId: string) => string;
  segmentLabel: (segmentId: string) => string;
}

function formatValue(condition: FlowCondition): string {
  if (VALUELESS_OPERATORS.includes(condition.operator)) return "";
  const { value } = condition;

  if (Array.isArray(value)) {
    if (value.length === 0) return "…";
    if (value.length === 1) return `“${String(value[0])}”`;
    return value.map((v) => `“${String(v)}”`).join(" or ");
  }
  if (value === undefined || value === null || value === "") return "…";
  return `“${String(value)}”`;
}

export function describeCondition(condition: FlowCondition, labels: FlowLabels): string {
  const operator = OPERATOR_LABELS[condition.operator] ?? condition.operator;
  const value = formatValue(condition);
  return [labels.fieldLabel(condition.fieldId), operator, value].filter(Boolean).join(" ");
}

function describeSide(
  action: LogicAction | null | undefined,
  targetFieldId: string | null | undefined,
  targetSegmentId: string | null | undefined,
  labels: FlowLabels,
): string {
  switch (action) {
    case "SUBMIT":
      return "finish the form";
    case "CONTINUE":
      return "continue in order";
    case "JUMP_TO_FIELD":
      return targetFieldId ? `go to ${labels.fieldLabel(targetFieldId)}` : "go to …";
    case "JUMP_TO_SEGMENT":
      return targetSegmentId ? `go to ${labels.segmentLabel(targetSegmentId)}` : "go to …";
    default:
      return "";
  }
}

export function describeRule(rule: FlowRule, labels: FlowLabels): string {
  const joiner = rule.match === "ANY" ? "any of" : "all of";

  const conditions =
    rule.conditions.length === 0
      ? "no conditions yet"
      : rule.conditions.map((c) => describeCondition(c, labels)).join(", ");

  const then = describeSide(rule.action, rule.targetFieldId, rule.targetSegmentId, labels);
  const otherwise = rule.elseAction
    ? describeSide(rule.elseAction, rule.elseTargetFieldId, rule.elseTargetSegmentId, labels)
    : null;

  const head = rule.conditions.length === 1 ? `If ${conditions}` : `If ${joiner}: ${conditions}`;

  return otherwise ? `${head} → ${then}, otherwise ${otherwise}` : `${head} → ${then}`;
}

/* ─── Linting ─────────────────────────────────────────────────────────── */

export type FlowIssueLevel = "error" | "warning";

export interface FlowIssue {
  level: FlowIssueLevel;
  message: string;
  ruleId?: string;
  fieldId?: string;
}

function isConditionComplete(condition: FlowCondition): boolean {
  if (VALUELESS_OPERATORS.includes(condition.operator)) return true;
  if (MULTI_VALUE_OPERATORS.includes(condition.operator)) {
    return Array.isArray(condition.value) && condition.value.length > 0;
  }
  return condition.value !== undefined && condition.value !== null && condition.value !== "";
}

function sideIsComplete(
  action: LogicAction | null | undefined,
  targetFieldId: string | null | undefined,
  targetSegmentId: string | null | undefined,
): boolean {
  if (action === "JUMP_TO_FIELD") return !!targetFieldId;
  if (action === "JUMP_TO_SEGMENT") return !!targetSegmentId;
  return true;
}

export function isRuleComplete(rule: FlowRule): boolean {
  if (rule.conditions.length === 0) return false;
  if (!rule.conditions.every(isConditionComplete)) return false;
  if (!sideIsComplete(rule.action, rule.targetFieldId, rule.targetSegmentId)) return false;
  if (
    rule.elseAction &&
    !sideIsComplete(rule.elseAction, rule.elseTargetFieldId, rule.elseTargetSegmentId)
  )
    return false;
  return true;
}

function firstFieldOfSegmentForLint(flow: Flow, segmentId: string): string | null {
  const start = flow.segments.findIndex((s) => s.id === segmentId);
  if (start === -1) return null;
  for (let i = start; i < flow.segments.length; i++) {
    const segment = flow.segments[i];
    if (!segment) continue;
    const field = flow.order.find((f) => f.segmentId === segment.id);
    if (field) return field.id;
  }
  return null;
}

export function lintFlow(flow: Flow, labels: FlowLabels): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const allRules = [...flow.rulesByFieldId.values()].flat();

  for (const rule of allRules) {
    const where = labels.fieldLabel(rule.fieldId);

    if (rule.conditions.length === 0) {
      issues.push({
        level: "warning",
        ruleId: rule.id,
        message: `A branch on ${where} has no conditions, so it never runs.`,
      });
    }

    for (const condition of rule.conditions) {
      if (!isConditionComplete(condition)) {
        issues.push({
          level: "error",
          ruleId: rule.id,
          message: `A condition on ${where} is missing the value to compare against.`,
        });
      }
      if (!flow.fieldById.has(condition.fieldId)) {
        issues.push({
          level: "error",
          ruleId: rule.id,
          message: `A branch on ${where} reads a question that no longer exists.`,
        });
      }
    }

    if (!sideIsComplete(rule.action, rule.targetFieldId, rule.targetSegmentId)) {
      issues.push({
        level: "error",
        ruleId: rule.id,
        message: `A branch on ${where} does not say where a match should go.`,
      });
    }
    if (
      rule.elseAction &&
      !sideIsComplete(rule.elseAction, rule.elseTargetFieldId, rule.elseTargetSegmentId)
    ) {
      issues.push({
        level: "error",
        ruleId: rule.id,
        message: `The otherwise branch on ${where} does not say where to go.`,
      });
    }

    const from = flow.positionById.get(rule.fieldId);
    for (const target of [rule.targetFieldId, rule.elseTargetFieldId]) {
      if (!target) continue;
      const to = flow.positionById.get(target);
      if (from !== undefined && to !== undefined && to <= from) {
        issues.push({
          level: "warning",
          ruleId: rule.id,
          message: `A branch on ${where} jumps backwards to ${labels.fieldLabel(target)}. Respondents who reach it a second time will finish the form instead.`,
        });
      }
    }
  }

  for (const [fieldId, rules] of flow.rulesByFieldId) {
    const decisive = rules.findIndex((r) => !!r.elseAction && isRuleComplete(r));
    if (decisive === -1) continue;
    for (const shadowed of rules.slice(decisive + 1)) {
      issues.push({
        level: "warning",
        ruleId: shadowed.id,
        message: `This branch never runs: an earlier branch on ${labels.fieldLabel(fieldId)} already handles both outcomes.`,
      });
    }
  }

  const edges = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string | null | undefined) => {
    if (!to) return;
    const set = edges.get(from) ?? new Set<string>();
    set.add(to);
    edges.set(from, set);
  };

  flow.order.forEach((field, i) => {
    const rules = flow.rulesByFieldId.get(field.id) ?? [];
    const next = flow.order[i + 1]?.id;

    const alwaysDecided =
      rules.length > 0 && rules.some((r) => !!r.elseAction && isRuleComplete(r));
    const anyContinue = rules.some((r) => r.action === "CONTINUE" || r.elseAction === "CONTINUE");
    if (!alwaysDecided || anyContinue) addEdge(field.id, next);

    for (const rule of rules) {
      addEdge(field.id, rule.targetFieldId);
      addEdge(field.id, rule.elseTargetFieldId);
      if (rule.targetSegmentId) {
        addEdge(field.id, firstFieldOfSegmentForLint(flow, rule.targetSegmentId));
      }
      if (rule.elseTargetSegmentId) {
        addEdge(field.id, firstFieldOfSegmentForLint(flow, rule.elseTargetSegmentId));
      }
    }
  });

  const start = flow.order[0]?.id;
  if (start) {
    const reached = new Set<string>([start]);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const next of edges.get(current) ?? []) {
        if (reached.has(next)) continue;
        reached.add(next);
        queue.push(next);
      }
    }

    for (const field of flow.order) {
      if (reached.has(field.id)) continue;
      issues.push({
        level: "warning",
        fieldId: field.id,
        message: `${labels.fieldLabel(field.id)} can't be reached by any answer.`,
      });
    }
  }

  return issues;
}
