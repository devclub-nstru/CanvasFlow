/**
 * Form traversal: which question comes next.
 *
 * Without branching this was `currentQuestionIndex + 1`. With segments and
 * conditional rules the order is no longer a property of the form alone — it
 * depends on what the respondent has answered so far. Everything here is pure
 * so the renderer stays a thin shell over it, the builder can describe and
 * lint rules with the same code the renderer obeys, and the whole thing can be
 * exercised without a browser.
 *
 * Three ideas carry the module:
 *
 *  1. A form is a flat list of questions ordered by (segment, question).
 *     Segments are groups, not a second traversal layer — "jump to segment 3"
 *     is really "jump to the first question of segment 3", which keeps one
 *     code path instead of two.
 *
 *  2. A rule is an if/else attached to the question that triggers it. Its
 *     conditions can read *any* question's answer, combined with ALL or ANY.
 *     When they hold it takes its `action`; when they don't it takes
 *     `elseAction` if it has one, and otherwise stands aside for the next rule.
 *
 *  3. Rules are checked in `index` order and the first decision wins. No
 *     decision means fall through to the next question in the flat list, which
 *     is what makes an un-branched form behave exactly as it did before.
 */

import { parseIndex } from "./fractional-index";

/* ─── Shapes ──────────────────────────────────────────────────────────────
 *
 * Structural types rather than imports from the server models: this module
 * only needs the properties it actually reads, and staying structural means
 * the builder's in-progress local rows (temp ids, no timestamps) satisfy it
 * too.
 */

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

/** Operators that test presence and take no operand. */
export const VALUELESS_OPERATORS: readonly LogicOperator[] = ["IS_EMPTY", "IS_NOT_EMPTY"];

/** Operators whose operand is a list of choices. */
export const MULTI_VALUE_OPERATORS: readonly LogicOperator[] = ["IS_ANY_OF", "IS_NONE_OF"];

/** Actions that carry no destination. */
export const TARGETLESS_ACTIONS: readonly LogicAction[] = ["SUBMIT", "CONTINUE"];

export interface FlowCondition {
  id: string;
  /** The question whose answer this condition reads. Any question in the form. */
  fieldId: string;
  operator: LogicOperator;
  value?: unknown;
  index: string | number;
}

export interface FlowRule {
  id: string;
  /** The question after which this rule is evaluated. */
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

/** Where the respondent goes next. `end` covers both "ran out of questions"
 *  and "a branch said finish here". */
export type NextStep = { kind: "field"; fieldId: string } | { kind: "end" };

/** A form flattened into traversal order, with the lookups the resolver needs.
 *  Build once per form and pass it around. */
export interface Flow {
  /** Every question in traversal order. */
  order: FlowField[];
  /** Position of each question id within `order`. */
  positionById: Map<string, number>;
  fieldById: Map<string, FlowField>;
  segmentById: Map<string, FlowSegment>;
  /** Segments in display order. Excludes the implicit segment. */
  segments: FlowSegment[];
  /** Rules grouped by their trigger question, each list in `index` order. */
  rulesByFieldId: Map<string, FlowRule[]>;
}

/* ─── Ordering ────────────────────────────────────────────────────────── */

function byIndex<T extends { index: string | number; id: string }>(a: T, b: T): number {
  const d = parseIndex(a.index) - parseIndex(b.index);
  if (d !== 0 && Number.isFinite(d)) return d;
  // Stable tiebreak. Two rows can share an index while a reorder is mid-save,
  // and an unstable sort there would make questions visibly swap.
  return a.id.localeCompare(b.id);
}

/**
 * Flatten a form into traversal order.
 *
 * Questions with no `segmentId` come first. They exist only on forms that were
 * never segmented (where they are the whole form) or, briefly, on a form whose
 * last segment was just deleted — in both cases "before every real segment" is
 * the intuitive place for them.
 */
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
      // Either genuinely unassigned, or assigned to a segment absent from the
      // list we were handed. Treating an unknown segment as unassigned keeps
      // the question reachable instead of silently dropping it.
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

/**
 * Whether an answer counts as "not given".
 *
 * `false` is deliberately NOT empty: an unchecked toggle is an answer, and
 * treating it as missing would make IS_EMPTY fire on a question the respondent
 * did answer. `0` is an answer for the same reason.
 */
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

/** Case- and whitespace-insensitive scalar comparison. Choice labels are free
 *  text typed twice — once on the question, once on the condition — so exact
 *  matching would fail on invisible differences. */
function scalarEquals(a: unknown, b: unknown): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") return toBoolean(a) === toBoolean(b);
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function normalise(v: unknown): string {
  return String(v).trim().toLowerCase();
}

/** Numeric comparison that also understands dates, so GREATER_THAN works on
 *  DATE/DATETIME answers. Returns null when either side isn't comparable —
 *  callers treat that as "no match" rather than guessing an ordering. */
function compareOrdered(answer: unknown, value: unknown): number | null {
  const a = Number(answer);
  const b = Number(value);
  if (Number.isFinite(a) && Number.isFinite(b)) return a - b;

  const da = Date.parse(String(answer));
  const dbv = Date.parse(String(value));
  if (Number.isFinite(da) && Number.isFinite(dbv)) return da - dbv;

  return null;
}

/** The operand as a list, for IS_ANY_OF / IS_NONE_OF. Tolerates a single
 *  scalar so a rule authored before the operator changed still behaves. */
function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

/**
 * Does one condition hold for the given answer?
 *
 * Multi-select answers arrive as arrays, which is why EQUALS has an
 * array-specific reading: "is X" on a checkbox question means X is the only
 * thing selected. An author who means "X is among the selections" reaches for
 * `contains`, and the two stay distinguishable.
 */
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

  // Every remaining operator compares against something. An unanswered
  // question matches none of them — except the negative ones, where "no
  // answer" genuinely is "not equal to X".
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
      // Unknown operator — an older client meeting a newer rule. Not matching
      // is the safe reading: the respondent continues linearly rather than
      // being sent somewhere arbitrary.
      return false;
  }
}

/**
 * Does a rule's condition set hold?
 *
 * A rule with no conditions returns false, never true. It's an incomplete rule
 * the author hasn't finished, and the safe reading of "no tests" is "does not
 * apply" — treating it as vacuously true would silently turn it into an
 * unconditional jump and reroute the whole form.
 */
export function ruleMatches(rule: FlowRule, answers: Answers): boolean {
  if (rule.conditions.length === 0) return false;

  const results = rule.conditions.map((condition) =>
    matchesCondition(condition, answers[condition.fieldId]),
  );

  return rule.match === "ANY" ? results.some(Boolean) : results.every(Boolean);
}

/* ─── Resolution ──────────────────────────────────────────────────────── */

/** The first question of a segment, skipping empty segments so a jump to a
 *  segment with no questions yet lands on the next real one instead of
 *  dead-ending. */
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

/** The next question in plain document order. */
function linearNext(flow: Flow, fromFieldId: string): string | null {
  const position = flow.positionById.get(fromFieldId);
  if (position === undefined) return null;
  return flow.order[position + 1]?.id ?? null;
}

/**
 * Where does the respondent go after answering `fromFieldId`?
 *
 * `visited` is the path taken so far and exists to break cycles. Rules can
 * describe a loop no single-row constraint can catch (A jumps to B, B jumps
 * back to A); the database rejects the one-hop case and this rejects the rest.
 * Landing on an already-visited question ends the form rather than trapping
 * the respondent — a wrong ending is recoverable, an infinite loop is not.
 */
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

/** Shared by the question-level and page-level walks so there is exactly one
 *  implementation of "is this destination usable". */
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

/**
 * The decision a question's rules reach, or `null` when none of them decides.
 *
 * Split out from `resolveNextStep` because the page-level walk needs to tell
 * "a rule sent them somewhere" apart from "nothing matched, carry on" — the
 * two are the same outcome for one question at a time, but on a multi-question
 * page only the first is a reason to leave. Keeping it as one function means
 * the two layouts can't drift on which rule wins.
 */
export function resolveRuleDecision(args: {
  flow: Flow;
  answers: Answers;
  fromFieldId: string;
  visited?: readonly string[];
}): NextStep | null {
  const { flow, answers, fromFieldId, visited = [] } = args;

  /** Turn one side of a rule into a step. `null` means the side declined to
   *  decide, so the next rule gets a turn. */
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
        // No action set, or one from a newer schema this client doesn't know.
        return null;
    }
  };

  for (const rule of flow.rulesByFieldId.get(fromFieldId) ?? []) {
    if (ruleMatches(rule, answers)) {
      const step = applySide(rule.action, rule.targetFieldId, rule.targetSegmentId);
      if (step) return step;
      continue;
    }

    // Conditions failed. A rule with an otherwise-branch is a fork and decides
    // here; a rule without one is a guard clause and stands aside.
    if (rule.elseAction) {
      const step = applySide(rule.elseAction, rule.elseTargetFieldId, rule.elseTargetSegmentId);
      if (step) return step;
    }
  }

  return null;
}

/** The question a respondent starts on. */
export function resolveFirstStep(flow: Flow): NextStep {
  const first = flow.order[0];
  return first ? { kind: "field", fieldId: first.id } : { kind: "end" };
}

/**
 * How many questions are still ahead, following current answers where they
 * exist and the linear fallback where they don't.
 *
 * Only used for the progress bar, which is why an estimate is acceptable:
 * with branching there is no single "total questions" to divide by, and a bar
 * that shifts as branches resolve beats one measured against a total the
 * respondent will never reach. Bounded by the question count, which also
 * bounds the walk.
 */
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

/**
 * The answers that belong to a completed run.
 *
 * A respondent who answers a question, goes back, and takes a different branch
 * leaves an answer behind for a question no longer on their path. Submitting it
 * would record a response to a question they were never asked, quietly
 * corrupting every per-question analytic. Only answers for questions actually
 * visited are kept.
 */
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

/**
 * Position of a question's segment for the "Segment 2 of 3" caption.
 * Returns null for the implicit segment, which has no title to show.
 */
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

/* ─── Pages ───────────────────────────────────────────────────────────────
 *
 * Everything above answers "which question comes next". A respondent, though,
 * sees a *page* at a time, and a page may hold one question or twenty. These
 * turn the question-level flow into the page-level one the renderer walks,
 * without duplicating any of the routing rules — a page's next step is still
 * decided by the same rules, just asked once per page instead of once per
 * question.
 */

/** What the author picked. AUTO defers to the form's shape. */
export type QuestionLayout = "AUTO" | "ONE_PER_PAGE" | "SEGMENT_PER_PAGE" | "ALL_AT_ONCE";

/** What AUTO actually became. The renderer only ever deals in these. */
export type ResolvedLayout = "ONE_PER_PAGE" | "SEGMENT_PER_PAGE" | "ALL_AT_ONCE";

export interface FlowPage {
  /** Stable across renders: the segment id, or a synthetic id for the pages
   *  that don't correspond to one. */
  id: string;
  /** Present when the page is a segment, so the renderer can show its title. */
  segment?: FlowSegment;
  fieldIds: string[];
}

/**
 * Can this form be shown on a single page?
 *
 * No, once it branches or once it has been split into segments.
 *
 * Branching is the hard one. A rule decides what comes *next*, which only means
 * anything if there is a next page to decide. Put every question on one page and
 * the routing has nowhere to apply: `buildPages` recomputes from the current
 * answers, so questions would appear and disappear under the respondent's cursor
 * as they filled the form in, and a branch that jumps forward would silently
 * delete the questions it skipped from a page already on screen.
 *
 * Segments are the softer one, and it's about intent. Splitting a form into
 * segments is an instruction to paginate it; flattening it back into one scroll
 * throws away both that instruction and the segment headings, which have nowhere
 * to render on a page that has no segment of its own.
 */
export function canRenderOnOnePage(segmentCount: number, ruleCount: number): boolean {
  return ruleCount === 0 && segmentCount <= 1;
}

/**
 * Turn the author's setting into a concrete layout.
 *
 * AUTO reads the form's shape rather than defaulting to a fixed mode. A form
 * with no segments — or one — is a single run of questions and reads best one
 * at a time. A form with several segments has already been divided into pages
 * by its author, and showing those pages is what dividing it was for. So
 * adding a second segment switches the form to page-per-segment on its own,
 * which is the behaviour an author expects without having to find a setting.
 *
 * ALL_AT_ONCE is overridden rather than trusted, because the setting and the
 * thing that invalidates it are edited independently: an author can choose one
 * page for a flat form and add branching to it a week later. Enforcing the rule
 * here means every consumer gets a layout that actually works, instead of each
 * one having to remember to check. The stored setting is deliberately left
 * alone, so removing the branching brings the author's choice back.
 */
export function resolveLayout(
  layout: QuestionLayout | undefined,
  segmentCount: number,
  ruleCount = 0,
): ResolvedLayout {
  /** What the form's own shape asks for. Also the fallback. */
  const paged: ResolvedLayout = segmentCount > 1 ? "SEGMENT_PER_PAGE" : "ONE_PER_PAGE";

  if (!layout || layout === "AUTO") return paged;
  if (layout === "ALL_AT_ONCE" && !canRenderOnOnePage(segmentCount, ruleCount)) return paged;

  return layout;
}

/**
 * Group a flow's questions into pages.
 *
 * ALL_AT_ONCE takes `answers` because with branching on, "everything" means
 * everything the respondent's answers actually lead to — a question on a road
 * not taken has no business being on the page. With no rules this collapses to
 * the full list, which is the plain Google-Forms reading.
 */
export function buildPages(flow: Flow, layout: ResolvedLayout, answers: Answers = {}): FlowPage[] {
  if (flow.order.length === 0) return [];

  if (layout === "ONE_PER_PAGE") {
    return flow.order.map((field) => ({ id: `q-${field.id}`, fieldIds: [field.id] }));
  }

  if (layout === "ALL_AT_ONCE") {
    return [{ id: "all", fieldIds: reachablePath(flow, answers) }];
  }

  /* SEGMENT_PER_PAGE. Questions with no segment lead, in their own page: they
   * only exist on forms that were never segmented, where they are the whole
   * form, so "one page" is right for them too. */
  const pages: FlowPage[] = [];

  const unassigned = flow.order.filter((f) => !f.segmentId || !flow.segmentById.has(f.segmentId));
  if (unassigned.length > 0) {
    pages.push({ id: "unassigned", fieldIds: unassigned.map((f) => f.id) });
  }

  for (const segment of flow.segments) {
    const fieldIds = flow.order.filter((f) => f.segmentId === segment.id).map((f) => f.id);
    // Empty segments are skipped rather than shown as a blank page with a
    // Next button, which is what an author mid-edit would otherwise publish.
    if (fieldIds.length === 0) continue;
    pages.push({ id: segment.id, segment, fieldIds });
  }

  return pages;
}

/**
 * The questions the current answers actually lead through, from the start.
 *
 * Used by ALL_AT_ONCE, where there is no "next" to resolve but the same
 * routing still has to decide what belongs on the page. Bounded by the
 * question count, which also bounds the walk if rules describe a cycle.
 */
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

/** The page holding a question, or -1. */
export function pageIndexOfField(pages: readonly FlowPage[], fieldId: string): number {
  return pages.findIndex((page) => page.fieldIds.includes(fieldId));
}

export type NextPage = { kind: "page"; pageIndex: number } | { kind: "end" };

/**
 * Where does the respondent go after finishing a page?
 *
 * Each question on the page is asked, in order, whether one of its rules
 * decides — the same first-match-wins evaluation used one question at a time.
 * The first decision that leads *off this page* wins.
 *
 * Decisions that land back on the same page are skipped rather than obeyed,
 * and that's the one genuinely page-specific rule here: "jump to question 3"
 * means nothing when question 3 is already on screen and already answerable.
 * Obeying it would either re-show the page or, worse, skip the rest of it.
 *
 * No decision at all means the next page in order, which keeps an unbranched
 * multi-page form behaving exactly as its author laid it out.
 */
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
    // Same cycle protection as the question-level walk: a page already visited
    // ends the form rather than trapping the respondent in a loop.
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

/** Remaining pages ahead, following current answers. Progress only. */
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
