import { parseIndex } from "./fractional-index";

export interface FlowField {
  id: string;
  segmentId?: string | null;
  label: string;
  type: string;
  isRequired: boolean;
  index: string | number;
  options?: unknown;
}

export interface FlowSegment {
  id: string;
  title: string;
  description?: string | null;
  index: string | number;
}

export type LogicOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "IS_EMPTY"
  | "IS_NOT_EMPTY"
  | "IS_ANY_OF"
  | "IS_NONE_OF"
  | "STARTS_WITH"
  | "ENDS_WITH";

export type LogicMatch = "ALL" | "ANY";

export type LogicAction = "JUMP_TO_FIELD" | "JUMP_TO_SEGMENT" | "SUBMIT" | "CONTINUE";

export const VALUELESS_OPERATORS: readonly LogicOperator[] = ["IS_EMPTY", "IS_NOT_EMPTY"];

export const MULTI_VALUE_OPERATORS: readonly LogicOperator[] = ["IS_ANY_OF", "IS_NONE_OF"];

export const TARGETLESS_ACTIONS: readonly LogicAction[] = ["SUBMIT", "CONTINUE"];

export interface FlowCondition {
  id: string;
  fieldId: string;
  operator: LogicOperator;
  value?: unknown;
  index: string | number;
}

export interface FlowRule {
  id: string;
  fieldId: string;
  match: LogicMatch;
  conditions: FlowCondition[];

  action: LogicAction;
  targetFieldId?: string | null;
  targetSegmentId?: string | null;

  elseAction?: LogicAction | null;
  elseTargetFieldId?: string | null;
  elseTargetSegmentId?: string | null;

  index: string | number;
}

export type Answers = Record<string, unknown>;

export type NextStep = { kind: "field"; fieldId: string } | { kind: "end" };
export interface Flow {
  order: FlowField[];
  positionById: Map<string, number>;
  fieldById: Map<string, FlowField>;
  segmentById: Map<string, FlowSegment>;
  segments: FlowSegment[];
  rulesByFieldId: Map<string, FlowRule[]>;
}

/* ─── Ordering ────────────────────────────────────────────────────────── */

function byIndex<T extends { index: string | number; id: string }>(a: T, b: T): number {
  const d = parseIndex(a.index) - parseIndex(b.index);
  if (d !== 0 && Number.isFinite(d)) return d;
  return a.id.localeCompare(b.id);
}

export function buildFlow(
  fields: readonly FlowField[],
  segments: readonly FlowSegment[] = [],
  rules: readonly FlowRule[] = [],
): Flow {
  const orderedSegments = [...segments].sort(byIndex);

  const unassigned: FlowField[] = [];
  const bySegment = new Map<string, FlowField[]>();
  for (const segment of orderedSegments) bySegment.set(segment.id, []);

  for (const field of fields) {
    const bucket = field.segmentId ? bySegment.get(field.segmentId) : undefined;
    if (bucket) {
      bucket.push(field);
    } else {
      unassigned.push(field);
    }
  }

  const order: FlowField[] = [...unassigned].sort(byIndex);
  for (const segment of orderedSegments) {
    order.push(...(bySegment.get(segment.id) ?? []).sort(byIndex));
  }

  const positionById = new Map<string, number>();
  order.forEach((field, i) => positionById.set(field.id, i));

  const rulesByFieldId = new Map<string, FlowRule[]>();
  for (const rule of rules) {
    const list = rulesByFieldId.get(rule.fieldId);
    if (list) list.push(rule);
    else rulesByFieldId.set(rule.fieldId, [rule]);
  }
  for (const list of rulesByFieldId.values()) list.sort(byIndex);

  return {
    order,
    positionById,
    fieldById: new Map(order.map((f) => [f.id, f])),
    segmentById: new Map(orderedSegments.map((s) => [s.id, s])),
    segments: orderedSegments,
    rulesByFieldId,
  };
}

/* ─── Condition matching ──────────────────────────────────────────────── */

export function isAnswerEmpty(answer: unknown): boolean {
  if (answer === undefined || answer === null) return true;
  if (typeof answer === "string") return answer.trim() === "";
  if (Array.isArray(answer)) return answer.length === 0;
  return false;
}

function toBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

function scalarEquals(a: unknown, b: unknown): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") return toBoolean(a) === toBoolean(b);
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function normalise(v: unknown): string {
  return String(v).trim().toLowerCase();
}

function compareOrdered(answer: unknown, value: unknown): number | null {
  const a = Number(answer);
  const b = Number(value);
  if (Number.isFinite(a) && Number.isFinite(b)) return a - b;

  const da = Date.parse(String(answer));
  const dbv = Date.parse(String(value));
  if (Number.isFinite(da) && Number.isFinite(dbv)) return da - dbv;

  return null;
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

export function matchesCondition(condition: FlowCondition, answer: unknown): boolean {
  const empty = isAnswerEmpty(answer);

  switch (condition.operator) {
    case "IS_EMPTY":
      return empty;
    case "IS_NOT_EMPTY":
      return !empty;
    default:
      break;
  }

  if (empty) {
    return (
      condition.operator === "NOT_EQUALS" ||
      condition.operator === "NOT_CONTAINS" ||
      condition.operator === "IS_NONE_OF"
    );
  }

  const { operator, value } = condition;

  switch (operator) {
    case "EQUALS":
      return Array.isArray(answer)
        ? answer.length === 1 && scalarEquals(answer[0], value)
        : scalarEquals(answer, value);

    case "NOT_EQUALS":
      return Array.isArray(answer)
        ? !(answer.length === 1 && scalarEquals(answer[0], value))
        : !scalarEquals(answer, value);

    case "CONTAINS":
      return Array.isArray(answer)
        ? answer.some((entry) => scalarEquals(entry, value))
        : normalise(answer).includes(normalise(value));

    case "NOT_CONTAINS":
      return Array.isArray(answer)
        ? !answer.some((entry) => scalarEquals(entry, value))
        : !normalise(answer).includes(normalise(value));

    case "IS_ANY_OF": {
      const list = asList(value);
      return Array.isArray(answer)
        ? answer.some((entry) => list.some((v) => scalarEquals(entry, v)))
        : list.some((v) => scalarEquals(answer, v));
    }

    case "IS_NONE_OF": {
      const list = asList(value);
      return Array.isArray(answer)
        ? !answer.some((entry) => list.some((v) => scalarEquals(entry, v)))
        : !list.some((v) => scalarEquals(answer, v));
    }

    case "STARTS_WITH":
      return normalise(Array.isArray(answer) ? answer[0] : answer).startsWith(normalise(value));

    case "ENDS_WITH":
      return normalise(Array.isArray(answer) ? answer[0] : answer).endsWith(normalise(value));

    case "GREATER_THAN": {
      const cmp = compareOrdered(answer, value);
      return cmp !== null && cmp > 0;
    }

    case "LESS_THAN": {
      const cmp = compareOrdered(answer, value);
      return cmp !== null && cmp < 0;
    }

    default:
      return false;
  }
}

export function ruleMatches(rule: FlowRule, answers: Answers): boolean {
  if (rule.conditions.length === 0) return false;

  const results = rule.conditions.map((condition) =>
    matchesCondition(condition, answers[condition.fieldId]),
  );

  return rule.match === "ANY" ? results.some(Boolean) : results.every(Boolean);
}

function firstFieldOfSegment(flow: Flow, segmentId: string): string | null {
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

function linearNext(flow: Flow, fromFieldId: string): string | null {
  const position = flow.positionById.get(fromFieldId);
  if (position === undefined) return null;
  return flow.order[position + 1]?.id ?? null;
}

export function resolveNextStep(args: {
  flow: Flow;
  answers: Answers;
  fromFieldId: string;
  visited?: readonly string[];
}): NextStep {
  const { flow, answers, fromFieldId, visited = [] } = args;

  const decision = resolveRuleDecision({ flow, answers, fromFieldId, visited });
  if (decision) return decision;

  return guardStep(flow, linearNext(flow, fromFieldId), visited);
}

function guardStep(
  flow: Flow,
  fieldId: string | null | undefined,
  visited: readonly string[],
): NextStep {
  if (!fieldId) return { kind: "end" };
  if (visited.includes(fieldId)) return { kind: "end" };
  if (!flow.fieldById.has(fieldId)) return { kind: "end" };
  return { kind: "field", fieldId };
}

export function resolveRuleDecision(args: {
  flow: Flow;
  answers: Answers;
  fromFieldId: string;
  visited?: readonly string[];
}): NextStep | null {
  const { flow, answers, fromFieldId, visited = [] } = args;

  const applySide = (
    action: LogicAction | null | undefined,
    targetFieldId: string | null | undefined,
    targetSegmentId: string | null | undefined,
  ): NextStep | null => {
    switch (action) {
      case "SUBMIT":
        return { kind: "end" };
      case "CONTINUE":
        return guardStep(flow, linearNext(flow, fromFieldId), visited);
      case "JUMP_TO_FIELD":
        return guardStep(flow, targetFieldId, visited);
      case "JUMP_TO_SEGMENT":
        return guardStep(
          flow,
          targetSegmentId ? firstFieldOfSegment(flow, targetSegmentId) : null,
          visited,
        );
      default:
        return null;
    }
  };

  for (const rule of flow.rulesByFieldId.get(fromFieldId) ?? []) {
    if (ruleMatches(rule, answers)) {
      const step = applySide(rule.action, rule.targetFieldId, rule.targetSegmentId);
      if (step) return step;
      continue;
    }

    if (rule.elseAction) {
      const step = applySide(rule.elseAction, rule.elseTargetFieldId, rule.elseTargetSegmentId);
      if (step) return step;
    }
  }

  return null;
}

export function resolveFirstStep(flow: Flow): NextStep {
  const first = flow.order[0];
  return first ? { kind: "field", fieldId: first.id } : { kind: "end" };
}

export function estimateRemaining(args: {
  flow: Flow;
  answers: Answers;
  fromFieldId: string;
  visited?: readonly string[];
}): number {
  const { flow, answers, fromFieldId, visited = [] } = args;

  const path = [...visited];
  let cursor = fromFieldId;
  let remaining = 0;

  for (let hops = 0; hops < flow.order.length; hops++) {
    const step = resolveNextStep({ flow, answers, fromFieldId: cursor, visited: path });
    if (step.kind === "end") break;
    remaining++;
    path.push(cursor);
    cursor = step.fieldId;
  }

  return remaining;
}

export function answersOnPath(
  answers: Answers,
  visitedFieldIds: readonly string[],
): Array<{ formFieldId: string; value: unknown }> {
  const seen = new Set<string>();
  const result: Array<{ formFieldId: string; value: unknown }> = [];

  for (const fieldId of visitedFieldIds) {
    if (seen.has(fieldId)) continue;
    seen.add(fieldId);
    if (!(fieldId in answers)) continue;
    result.push({ formFieldId: fieldId, value: answers[fieldId] });
  }

  return result;
}

export function segmentProgress(
  flow: Flow,
  fieldId: string,
): { segment: FlowSegment; position: number; total: number } | null {
  const field = flow.fieldById.get(fieldId);
  if (!field?.segmentId) return null;

  const segment = flow.segmentById.get(field.segmentId);
  if (!segment) return null;

  const position = flow.segments.findIndex((s) => s.id === segment.id);
  if (position === -1) return null;

  return { segment, position: position + 1, total: flow.segments.length };
}

export type QuestionLayout = "AUTO" | "ONE_PER_PAGE" | "SEGMENT_PER_PAGE" | "ALL_AT_ONCE";

export type ResolvedLayout = "ONE_PER_PAGE" | "SEGMENT_PER_PAGE" | "ALL_AT_ONCE";

export interface FlowPage {
  id: string;
  segment?: FlowSegment;
  fieldIds: string[];
}

export function canRenderOnOnePage(segmentCount: number, ruleCount: number): boolean {
  return ruleCount === 0 && segmentCount <= 1;
}

export function resolveLayout(
  layout: QuestionLayout | undefined,
  segmentCount: number,
  ruleCount = 0,
): ResolvedLayout {
  const paged: ResolvedLayout = segmentCount > 1 ? "SEGMENT_PER_PAGE" : "ONE_PER_PAGE";

  if (!layout || layout === "AUTO") return paged;
  if (layout === "ALL_AT_ONCE" && !canRenderOnOnePage(segmentCount, ruleCount)) return paged;

  return layout;
}

export function buildPages(flow: Flow, layout: ResolvedLayout, answers: Answers = {}): FlowPage[] {
  if (flow.order.length === 0) return [];

  if (layout === "ONE_PER_PAGE") {
    return flow.order.map((field) => ({ id: `q-${field.id}`, fieldIds: [field.id] }));
  }

  if (layout === "ALL_AT_ONCE") {
    return [{ id: "all", fieldIds: reachablePath(flow, answers) }];
  }

  const pages: FlowPage[] = [];

  const unassigned = flow.order.filter((f) => !f.segmentId || !flow.segmentById.has(f.segmentId));
  if (unassigned.length > 0) {
    pages.push({ id: "unassigned", fieldIds: unassigned.map((f) => f.id) });
  }

  for (const segment of flow.segments) {
    const fieldIds = flow.order.filter((f) => f.segmentId === segment.id).map((f) => f.id);
    if (fieldIds.length === 0) continue;
    pages.push({ id: segment.id, segment, fieldIds });
  }

  return pages;
}

export function reachablePath(flow: Flow, answers: Answers): string[] {
  const first = flow.order[0];
  if (!first) return [];

  const path: string[] = [first.id];
  let cursor = first.id;

  for (let hops = 0; hops < flow.order.length; hops++) {
    const step = resolveNextStep({ flow, answers, fromFieldId: cursor, visited: path });
    if (step.kind === "end") break;
    path.push(step.fieldId);
    cursor = step.fieldId;
  }

  return path;
}

export function pageIndexOfField(pages: readonly FlowPage[], fieldId: string): number {
  return pages.findIndex((page) => page.fieldIds.includes(fieldId));
}

export type NextPage = { kind: "page"; pageIndex: number } | { kind: "end" };

export function resolveNextPage(args: {
  flow: Flow;
  pages: readonly FlowPage[];
  answers: Answers;
  currentPageIndex: number;
  visitedPageIndexes?: readonly number[];
}): NextPage {
  const { flow, pages, answers, currentPageIndex, visitedPageIndexes = [] } = args;

  const page = pages[currentPageIndex];
  if (!page) return { kind: "end" };

  const seen = new Set(visitedPageIndexes);

  const guard = (pageIndex: number): NextPage => {
    if (pageIndex < 0 || pageIndex >= pages.length) return { kind: "end" };
    if (seen.has(pageIndex)) return { kind: "end" };
    return { kind: "page", pageIndex };
  };

  for (const fieldId of page.fieldIds) {
    const decision = resolveRuleDecision({ flow, answers, fromFieldId: fieldId });
    if (!decision) continue;

    if (decision.kind === "end") return { kind: "end" };

    const targetPage = pageIndexOfField(pages, decision.fieldId);
    if (targetPage === -1) return { kind: "end" };
    if (targetPage === currentPageIndex) continue;

    return guard(targetPage);
  }

  return guard(currentPageIndex + 1);
}

export function estimateRemainingPages(args: {
  flow: Flow;
  pages: readonly FlowPage[];
  answers: Answers;
  currentPageIndex: number;
  visitedPageIndexes?: readonly number[];
}): number {
  const { flow, pages, answers, currentPageIndex, visitedPageIndexes = [] } = args;

  const path = [...visitedPageIndexes];
  let cursor = currentPageIndex;
  let remaining = 0;

  for (let hops = 0; hops < pages.length; hops++) {
    const step = resolveNextPage({
      flow,
      pages,
      answers,
      currentPageIndex: cursor,
      visitedPageIndexes: path,
    });
    if (step.kind === "end") break;
    remaining++;
    path.push(cursor);
    cursor = step.pageIndex;
  }

  return remaining;
}
