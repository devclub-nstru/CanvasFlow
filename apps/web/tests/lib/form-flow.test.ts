import { describe, expect, it } from "vitest";
import {
  buildFlow,
  isAnswerEmpty,
  matchesCondition,
  ruleMatches,
  resolveFirstStep,
  resolveNextStep,
  resolveRuleDecision,
  estimateRemaining,
  answersOnPath,
  segmentProgress,
  canRenderOnOnePage,
  resolveLayout,
  buildPages,
  reachablePath,
  pageIndexOfField,
  resolveNextPage,
  estimateRemainingPages,
  type FlowCondition,
  type FlowField,
  type FlowRule,
  type FlowSegment,
  type LogicOperator,
} from "~/lib/form-flow";

/* ─── Fixtures ─────────────────────────────────────────────────────────── */

function field(id: string, index: number, extra: Partial<FlowField> = {}): FlowField {
  return {
    id,
    label: id.toUpperCase(),
    type: "SHORT_TEXT",
    isRequired: false,
    index,
    ...extra,
  };
}

function segment(id: string, index: number): FlowSegment {
  return { id, title: id.toUpperCase(), index };
}

function condition(
  fieldId: string,
  operator: LogicOperator,
  value?: unknown,
  index = 0,
): FlowCondition {
  return { id: `c-${fieldId}-${operator}-${index}`, fieldId, operator, value, index };
}

function rule(id: string, fieldId: string, extra: Partial<FlowRule> = {}): FlowRule {
  return {
    id,
    fieldId,
    match: "ALL",
    conditions: [],
    action: "CONTINUE",
    index: 0,
    ...extra,
  };
}

/* ─── buildFlow ────────────────────────────────────────────────────────── */

describe("buildFlow", () => {
  it("orders unassigned fields by index", () => {
    const flow = buildFlow([field("b", 2), field("a", 1), field("c", 3)]);
    expect(flow.order.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });

  it("falls back to id order when two indexes tie", () => {
    const flow = buildFlow([field("z", 1), field("a", 1)]);
    expect(flow.order.map((f) => f.id)).toEqual(["a", "z"]);
  });

  it("falls back to id order when an index is unparseable", () => {
    const flow = buildFlow([field("z", "oops" as unknown as number), field("a", "nope" as unknown as number)]);
    expect(flow.order.map((f) => f.id)).toEqual(["a", "z"]);
  });

  it("places unassigned fields before every segment", () => {
    const flow = buildFlow(
      [field("inSeg", 1, { segmentId: "s1" }), field("loose", 99)],
      [segment("s1", 1)],
    );
    expect(flow.order.map((f) => f.id)).toEqual(["loose", "inSeg"]);
  });

  it("groups fields by segment and orders segments by their own index", () => {
    const flow = buildFlow(
      [
        field("b1", 1, { segmentId: "second" }),
        field("a2", 2, { segmentId: "first" }),
        field("a1", 1, { segmentId: "first" }),
      ],
      [segment("second", 2), segment("first", 1)],
    );
    expect(flow.order.map((f) => f.id)).toEqual(["a1", "a2", "b1"]);
    expect(flow.segments.map((s) => s.id)).toEqual(["first", "second"]);
  });

  it("treats a field pointing at a missing segment as unassigned", () => {
    const flow = buildFlow([field("orphan", 1, { segmentId: "ghost" })], []);
    expect(flow.order.map((f) => f.id)).toEqual(["orphan"]);
  });

  it("indexes positions, fields and segments for lookup", () => {
    const flow = buildFlow([field("a", 1), field("b", 2)], [segment("s", 1)]);
    expect(flow.positionById.get("a")).toBe(0);
    expect(flow.positionById.get("b")).toBe(1);
    expect(flow.fieldById.get("b")?.label).toBe("B");
    expect(flow.segmentById.get("s")?.title).toBe("S");
  });

  it("buckets rules by field and sorts each bucket by index", () => {
    const flow = buildFlow(
      [field("a", 1)],
      [],
      [rule("r2", "a", { index: 2 }), rule("r1", "a", { index: 1 })],
    );
    expect(flow.rulesByFieldId.get("a")?.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("returns an empty flow for no fields", () => {
    const flow = buildFlow([]);
    expect(flow.order).toEqual([]);
    expect(resolveFirstStep(flow)).toEqual({ kind: "end" });
  });
});

/* ─── isAnswerEmpty ────────────────────────────────────────────────────── */

describe("isAnswerEmpty", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
    ["whitespace", "   "],
    ["empty array", []],
  ])("treats %s as empty", (_label, value) => {
    expect(isAnswerEmpty(value)).toBe(true);
  });

  it.each([
    ["text", "a"],
    ["zero", 0],
    ["false", false],
    ["populated array", ["a"]],
    ["object", {}],
  ])("treats %s as answered", (_label, value) => {
    expect(isAnswerEmpty(value)).toBe(false);
  });
});

/* ─── matchesCondition ─────────────────────────────────────────────────── */

describe("matchesCondition — emptiness operators", () => {
  it("IS_EMPTY is true only for an empty answer", () => {
    expect(matchesCondition(condition("a", "IS_EMPTY"), "")).toBe(true);
    expect(matchesCondition(condition("a", "IS_EMPTY"), "x")).toBe(false);
  });

  it("IS_NOT_EMPTY is the inverse", () => {
    expect(matchesCondition(condition("a", "IS_NOT_EMPTY"), "x")).toBe(true);
    expect(matchesCondition(condition("a", "IS_NOT_EMPTY"), [])).toBe(false);
  });
});

describe("matchesCondition — empty answers against value operators", () => {
  it.each<[LogicOperator, boolean]>([
    ["NOT_EQUALS", true],
    ["NOT_CONTAINS", true],
    ["IS_NONE_OF", true],
    ["EQUALS", false],
    ["CONTAINS", false],
    ["IS_ANY_OF", false],
    ["STARTS_WITH", false],
    ["ENDS_WITH", false],
    ["GREATER_THAN", false],
    ["LESS_THAN", false],
  ])("%s against an unanswered field is %s", (operator, expected) => {
    expect(matchesCondition(condition("a", operator, "x"), undefined)).toBe(expected);
  });
});

describe("matchesCondition — EQUALS / NOT_EQUALS", () => {
  it("compares case- and whitespace-insensitively", () => {
    expect(matchesCondition(condition("a", "EQUALS", "Yes"), " yes ")).toBe(true);
  });

  it("coerces booleans from their common written forms", () => {
    expect(matchesCondition(condition("a", "EQUALS", true), "yes")).toBe(true);
    expect(matchesCondition(condition("a", "EQUALS", true), "1")).toBe(true);
    expect(matchesCondition(condition("a", "EQUALS", false), "no")).toBe(true);
    expect(matchesCondition(condition("a", "EQUALS", true), "nope")).toBe(false);
  });

  it("matches a single-selection array against a scalar", () => {
    expect(matchesCondition(condition("a", "EQUALS", "red"), ["RED"])).toBe(true);
  });

  it("does not match a multi-selection array", () => {
    expect(matchesCondition(condition("a", "EQUALS", "red"), ["red", "blue"])).toBe(false);
  });

  it("NOT_EQUALS is the exact inverse for both shapes", () => {
    expect(matchesCondition(condition("a", "NOT_EQUALS", "red"), "blue")).toBe(true);
    expect(matchesCondition(condition("a", "NOT_EQUALS", "red"), ["red"])).toBe(false);
    expect(matchesCondition(condition("a", "NOT_EQUALS", "red"), ["red", "blue"])).toBe(true);
  });
});

describe("matchesCondition — CONTAINS / NOT_CONTAINS", () => {
  it("is a substring test for text answers", () => {
    expect(matchesCondition(condition("a", "CONTAINS", "world"), "Hello World")).toBe(true);
    expect(matchesCondition(condition("a", "CONTAINS", "moon"), "Hello World")).toBe(false);
  });

  it("is a membership test for array answers", () => {
    expect(matchesCondition(condition("a", "CONTAINS", "Blue"), ["red", "blue"])).toBe(true);
    expect(matchesCondition(condition("a", "CONTAINS", "green"), ["red", "blue"])).toBe(false);
  });

  it("NOT_CONTAINS inverts both shapes", () => {
    expect(matchesCondition(condition("a", "NOT_CONTAINS", "moon"), "Hello World")).toBe(true);
    expect(matchesCondition(condition("a", "NOT_CONTAINS", "blue"), ["red", "blue"])).toBe(false);
  });
});

describe("matchesCondition — IS_ANY_OF / IS_NONE_OF", () => {
  it("accepts an array of candidate values", () => {
    expect(matchesCondition(condition("a", "IS_ANY_OF", ["red", "blue"]), "BLUE")).toBe(true);
    expect(matchesCondition(condition("a", "IS_ANY_OF", ["red", "blue"]), "green")).toBe(false);
  });

  it("accepts a lone scalar as a one-item list", () => {
    expect(matchesCondition(condition("a", "IS_ANY_OF", "red"), "red")).toBe(true);
  });

  it("intersects when the answer is itself a list", () => {
    expect(matchesCondition(condition("a", "IS_ANY_OF", ["red"]), ["green", "red"])).toBe(true);
    expect(matchesCondition(condition("a", "IS_NONE_OF", ["red"]), ["green", "blue"])).toBe(true);
    expect(matchesCondition(condition("a", "IS_NONE_OF", ["red"]), ["green", "red"])).toBe(false);
  });

  it("treats an empty candidate list as matching nothing", () => {
    expect(matchesCondition(condition("a", "IS_ANY_OF", []), "red")).toBe(false);
    expect(matchesCondition(condition("a", "IS_NONE_OF", []), "red")).toBe(true);
  });
});

describe("matchesCondition — STARTS_WITH / ENDS_WITH", () => {
  it("compares normalised text", () => {
    expect(matchesCondition(condition("a", "STARTS_WITH", "hel"), "Hello")).toBe(true);
    expect(matchesCondition(condition("a", "ENDS_WITH", "LO"), " hello ")).toBe(true);
    expect(matchesCondition(condition("a", "STARTS_WITH", "lo"), "Hello")).toBe(false);
  });

  it("uses only the first entry of an array answer", () => {
    expect(matchesCondition(condition("a", "STARTS_WITH", "re"), ["red", "blue"])).toBe(true);
    expect(matchesCondition(condition("a", "STARTS_WITH", "bl"), ["red", "blue"])).toBe(false);
  });
});

describe("matchesCondition — GREATER_THAN / LESS_THAN", () => {
  it("compares numerically, including numeric strings", () => {
    expect(matchesCondition(condition("a", "GREATER_THAN", 3), 5)).toBe(true);
    expect(matchesCondition(condition("a", "GREATER_THAN", "3"), "5")).toBe(true);
    expect(matchesCondition(condition("a", "LESS_THAN", 3), 5)).toBe(false);
    expect(matchesCondition(condition("a", "LESS_THAN", 10), "5")).toBe(true);
  });

  it("is strict at the boundary", () => {
    expect(matchesCondition(condition("a", "GREATER_THAN", 5), 5)).toBe(false);
    expect(matchesCondition(condition("a", "LESS_THAN", 5), 5)).toBe(false);
  });

  it("falls back to date comparison when the values are not numbers", () => {
    expect(matchesCondition(condition("a", "GREATER_THAN", "2024-01-01"), "2024-05-10")).toBe(true);
    expect(matchesCondition(condition("a", "LESS_THAN", "2024-01-01"), "2024-05-10")).toBe(false);
  });

  it("is false when neither a number nor a date can be read", () => {
    expect(matchesCondition(condition("a", "GREATER_THAN", "def"), "abc")).toBe(false);
    expect(matchesCondition(condition("a", "LESS_THAN", "def"), "abc")).toBe(false);
  });
});

describe("matchesCondition — unknown operator", () => {
  it("never matches", () => {
    const bogus = condition("a", "NOT_A_REAL_OPERATOR" as LogicOperator, "x");
    expect(matchesCondition(bogus, "x")).toBe(false);
  });
});

/* ─── ruleMatches ──────────────────────────────────────────────────────── */

describe("ruleMatches", () => {
  it("never fires a rule with no conditions", () => {
    expect(ruleMatches(rule("r", "a"), { a: "x" })).toBe(false);
  });

  it("ALL requires every condition", () => {
    const r = rule("r", "a", {
      match: "ALL",
      conditions: [condition("a", "EQUALS", "x"), condition("b", "EQUALS", "y")],
    });
    expect(ruleMatches(r, { a: "x", b: "y" })).toBe(true);
    expect(ruleMatches(r, { a: "x", b: "z" })).toBe(false);
  });

  it("ANY requires one condition", () => {
    const r = rule("r", "a", {
      match: "ANY",
      conditions: [condition("a", "EQUALS", "x"), condition("b", "EQUALS", "y")],
    });
    expect(ruleMatches(r, { a: "no", b: "y" })).toBe(true);
    expect(ruleMatches(r, { a: "no", b: "no" })).toBe(false);
  });

  it("reads each condition against its own field, not the rule's field", () => {
    const r = rule("r", "a", { conditions: [condition("b", "EQUALS", "x")] });
    expect(ruleMatches(r, { a: "wrong", b: "x" })).toBe(true);
  });
});

/* ─── resolveRuleDecision / resolveNextStep ────────────────────────────── */

describe("resolveRuleDecision", () => {
  const fields = [field("a", 1), field("b", 2), field("c", 3)];

  it("returns null when the field has no rules", () => {
    const flow = buildFlow(fields);
    expect(resolveRuleDecision({ flow, answers: {}, fromFieldId: "a" })).toBeNull();
  });

  it("returns null when a rule neither matches nor has an else branch", () => {
    const flow = buildFlow(fields, [], [
      rule("r", "a", {
        conditions: [condition("a", "EQUALS", "yes")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "c",
      }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "no" }, fromFieldId: "a" })).toBeNull();
  });

  it("jumps to the target field when the rule matches", () => {
    const flow = buildFlow(fields, [], [
      rule("r", "a", {
        conditions: [condition("a", "EQUALS", "yes")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "c",
      }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "yes" }, fromFieldId: "a" })).toEqual({
      kind: "field",
      fieldId: "c",
    });
  });

  it("ends the form on SUBMIT", () => {
    const flow = buildFlow(fields, [], [
      rule("r", "a", { conditions: [condition("a", "IS_NOT_EMPTY")], action: "SUBMIT" }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "x" }, fromFieldId: "a" })).toEqual({
      kind: "end",
    });
  });

  it("falls through to the neighbour on CONTINUE", () => {
    const flow = buildFlow(fields, [], [
      rule("r", "a", { conditions: [condition("a", "IS_NOT_EMPTY")], action: "CONTINUE" }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "x" }, fromFieldId: "a" })).toEqual({
      kind: "field",
      fieldId: "b",
    });
  });

  it("uses the else branch when the rule does not match", () => {
    const flow = buildFlow(fields, [], [
      rule("r", "a", {
        conditions: [condition("a", "EQUALS", "yes")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "c",
        elseAction: "SUBMIT",
      }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "no" }, fromFieldId: "a" })).toEqual({
      kind: "end",
    });
  });

  it("ends rather than jumping to a field that is not in the flow", () => {
    const flow = buildFlow(fields, [], [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "ghost",
      }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "x" }, fromFieldId: "a" })).toEqual({
      kind: "end",
    });
  });

  it("ends rather than looping back to an already visited field", () => {
    const flow = buildFlow(fields, [], [
      rule("r", "b", {
        conditions: [condition("b", "IS_NOT_EMPTY")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "a",
      }),
    ]);
    expect(
      resolveRuleDecision({ flow, answers: { b: "x" }, fromFieldId: "b", visited: ["a"] }),
    ).toEqual({ kind: "end" });
  });

  it("ends when a jump rule has no target configured", () => {
    const flow = buildFlow(fields, [], [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_FIELD",
        targetFieldId: null,
      }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "x" }, fromFieldId: "a" })).toEqual({
      kind: "end",
    });
  });

  it("takes the first rule that produces a decision", () => {
    const flow = buildFlow(fields, [], [
      rule("second", "a", {
        index: 2,
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "SUBMIT",
      }),
      rule("first", "a", {
        index: 1,
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "c",
      }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "x" }, fromFieldId: "a" })).toEqual({
      kind: "field",
      fieldId: "c",
    });
  });
});

describe("resolveRuleDecision — JUMP_TO_SEGMENT", () => {
  const fields = [
    field("a", 1),
    field("s1f", 1, { segmentId: "s1" }),
    field("s3f", 1, { segmentId: "s3" }),
  ];
  const segments = [segment("s1", 1), segment("s2", 2), segment("s3", 3)];

  it("lands on the first field of the target segment", () => {
    const flow = buildFlow(fields, segments, [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_SEGMENT",
        targetSegmentId: "s1",
      }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "x" }, fromFieldId: "a" })).toEqual({
      kind: "field",
      fieldId: "s1f",
    });
  });

  it("skips forward past an empty segment", () => {
    const flow = buildFlow(fields, segments, [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_SEGMENT",
        targetSegmentId: "s2",
      }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "x" }, fromFieldId: "a" })).toEqual({
      kind: "field",
      fieldId: "s3f",
    });
  });

  it("ends when the target segment does not exist", () => {
    const flow = buildFlow(fields, segments, [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_SEGMENT",
        targetSegmentId: "ghost",
      }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "x" }, fromFieldId: "a" })).toEqual({
      kind: "end",
    });
  });
});

describe("resolveNextStep", () => {
  const flow = buildFlow([field("a", 1), field("b", 2), field("c", 3)]);

  it("walks linearly when no rule applies", () => {
    expect(resolveNextStep({ flow, answers: {}, fromFieldId: "a" })).toEqual({
      kind: "field",
      fieldId: "b",
    });
  });

  it("ends after the last field", () => {
    expect(resolveNextStep({ flow, answers: {}, fromFieldId: "c" })).toEqual({ kind: "end" });
  });

  it("ends when asked to continue from a field outside the flow", () => {
    expect(resolveNextStep({ flow, answers: {}, fromFieldId: "ghost" })).toEqual({ kind: "end" });
  });

  it("ends rather than revisiting a field already on the path", () => {
    expect(resolveNextStep({ flow, answers: {}, fromFieldId: "a", visited: ["b"] })).toEqual({
      kind: "end",
    });
  });
});

describe("resolveFirstStep", () => {
  it("returns the first field in order", () => {
    const flow = buildFlow([field("b", 2), field("a", 1)]);
    expect(resolveFirstStep(flow)).toEqual({ kind: "field", fieldId: "a" });
  });
});

/* ─── Path helpers ─────────────────────────────────────────────────────── */

describe("reachablePath", () => {
  it("is the whole form when nothing branches", () => {
    const flow = buildFlow([field("a", 1), field("b", 2), field("c", 3)]);
    expect(reachablePath(flow, {})).toEqual(["a", "b", "c"]);
  });

  it("skips fields a jump passes over", () => {
    const flow = buildFlow([field("a", 1), field("b", 2), field("c", 3)], [], [
      rule("r", "a", {
        conditions: [condition("a", "EQUALS", "skip")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "c",
      }),
    ]);
    expect(reachablePath(flow, { a: "skip" })).toEqual(["a", "c"]);
    expect(reachablePath(flow, { a: "stay" })).toEqual(["a", "b", "c"]);
  });

  it("terminates on a rule that points backwards instead of looping forever", () => {
    const flow = buildFlow([field("a", 1), field("b", 2)], [], [
      rule("r", "b", {
        conditions: [condition("b", "IS_NOT_EMPTY")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "a",
      }),
    ]);
    expect(reachablePath(flow, { b: "x" })).toEqual(["a", "b"]);
  });

  it("is empty for an empty flow", () => {
    expect(reachablePath(buildFlow([]), {})).toEqual([]);
  });
});

describe("estimateRemaining", () => {
  it("counts the fields still ahead on the linear path", () => {
    const flow = buildFlow([field("a", 1), field("b", 2), field("c", 3)]);
    expect(estimateRemaining({ flow, answers: {}, fromFieldId: "a" })).toBe(2);
    expect(estimateRemaining({ flow, answers: {}, fromFieldId: "c" })).toBe(0);
  });

  it("shrinks when logic skips ahead", () => {
    const flow = buildFlow([field("a", 1), field("b", 2), field("c", 3)], [], [
      rule("r", "a", {
        conditions: [condition("a", "EQUALS", "skip")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "c",
      }),
    ]);
    expect(estimateRemaining({ flow, answers: { a: "skip" }, fromFieldId: "a" })).toBe(1);
  });
});

describe("answersOnPath", () => {
  const answers = { a: "one", b: "two", c: "three" };

  it("keeps only the visited fields, in visit order", () => {
    expect(answersOnPath(answers, ["c", "a"])).toEqual([
      { formFieldId: "c", value: "three" },
      { formFieldId: "a", value: "one" },
    ]);
  });

  it("drops duplicates", () => {
    expect(answersOnPath(answers, ["a", "a"])).toEqual([{ formFieldId: "a", value: "one" }]);
  });

  it("drops visited fields that were never answered", () => {
    expect(answersOnPath(answers, ["a", "unanswered"])).toEqual([
      { formFieldId: "a", value: "one" },
    ]);
  });

  it("keeps an explicitly empty answer, because clearing a field is a value", () => {
    expect(answersOnPath({ a: "" }, ["a"])).toEqual([{ formFieldId: "a", value: "" }]);
  });
});

describe("segmentProgress", () => {
  const flow = buildFlow(
    [field("f1", 1, { segmentId: "s1" }), field("f2", 1, { segmentId: "s2" }), field("loose", 1)],
    [segment("s1", 1), segment("s2", 2)],
  );

  it("reports a one-based position within the segment list", () => {
    expect(segmentProgress(flow, "f2")).toMatchObject({ position: 2, total: 2 });
    expect(segmentProgress(flow, "f1")?.segment.id).toBe("s1");
  });

  it("returns null for a field outside any segment", () => {
    expect(segmentProgress(flow, "loose")).toBeNull();
  });

  it("returns null for a field that is not in the flow", () => {
    expect(segmentProgress(flow, "ghost")).toBeNull();
  });
});

/* ─── Layout ───────────────────────────────────────────────────────────── */

describe("canRenderOnOnePage", () => {
  it("allows a single page only without logic and with at most one segment", () => {
    expect(canRenderOnOnePage(0, 0)).toBe(true);
    expect(canRenderOnOnePage(1, 0)).toBe(true);
    expect(canRenderOnOnePage(2, 0)).toBe(false);
    expect(canRenderOnOnePage(1, 1)).toBe(false);
  });
});

describe("resolveLayout", () => {
  it("AUTO picks one question per page for a flat form", () => {
    expect(resolveLayout("AUTO", 0, 0)).toBe("ONE_PER_PAGE");
    expect(resolveLayout(undefined, 1, 0)).toBe("ONE_PER_PAGE");
  });

  it("AUTO picks a page per segment once there is more than one segment", () => {
    expect(resolveLayout("AUTO", 2, 0)).toBe("SEGMENT_PER_PAGE");
  });

  it("honours an explicit choice", () => {
    expect(resolveLayout("ONE_PER_PAGE", 5, 3)).toBe("ONE_PER_PAGE");
    expect(resolveLayout("SEGMENT_PER_PAGE", 0, 0)).toBe("SEGMENT_PER_PAGE");
  });

  it("refuses ALL_AT_ONCE when logic or multiple segments make it unsafe", () => {
    expect(resolveLayout("ALL_AT_ONCE", 0, 0)).toBe("ALL_AT_ONCE");
    expect(resolveLayout("ALL_AT_ONCE", 0, 1)).toBe("ONE_PER_PAGE");
    expect(resolveLayout("ALL_AT_ONCE", 3, 0)).toBe("SEGMENT_PER_PAGE");
  });
});

describe("buildPages", () => {
  const fields = [
    field("loose", 1),
    field("f1", 1, { segmentId: "s1" }),
    field("f2", 2, { segmentId: "s1" }),
    field("f3", 1, { segmentId: "s2" }),
  ];
  const segments = [segment("s1", 1), segment("s2", 2), segment("empty", 3)];

  it("returns nothing for an empty flow", () => {
    expect(buildPages(buildFlow([]), "ONE_PER_PAGE")).toEqual([]);
  });

  it("ONE_PER_PAGE gives every field its own page", () => {
    const pages = buildPages(buildFlow(fields, segments), "ONE_PER_PAGE");
    expect(pages).toHaveLength(4);
    expect(pages[0]).toEqual({ id: "q-loose", fieldIds: ["loose"] });
  });

  it("SEGMENT_PER_PAGE puts unassigned fields on their own leading page", () => {
    const pages = buildPages(buildFlow(fields, segments), "SEGMENT_PER_PAGE");
    expect(pages.map((p) => p.id)).toEqual(["unassigned", "s1", "s2"]);
    expect(pages[1]?.fieldIds).toEqual(["f1", "f2"]);
    expect(pages[1]?.segment?.id).toBe("s1");
  });

  it("SEGMENT_PER_PAGE omits a segment with no fields", () => {
    const pages = buildPages(buildFlow(fields, segments), "SEGMENT_PER_PAGE");
    expect(pages.map((p) => p.id)).not.toContain("empty");
  });

  it("SEGMENT_PER_PAGE omits the unassigned page when every field has a segment", () => {
    const pages = buildPages(buildFlow(fields.slice(1), segments), "SEGMENT_PER_PAGE");
    expect(pages.map((p) => p.id)).toEqual(["s1", "s2"]);
  });

  it("ALL_AT_ONCE collapses the reachable path into one page", () => {
    const pages = buildPages(buildFlow(fields, segments), "ALL_AT_ONCE");
    expect(pages).toHaveLength(1);
    expect(pages[0]?.id).toBe("all");
    expect(pages[0]?.fieldIds).toEqual(["loose", "f1", "f2", "f3"]);
  });
});

describe("pageIndexOfField", () => {
  const pages = [
    { id: "p0", fieldIds: ["a", "b"] },
    { id: "p1", fieldIds: ["c"] },
  ];

  it("finds the page holding the field", () => {
    expect(pageIndexOfField(pages, "b")).toBe(0);
    expect(pageIndexOfField(pages, "c")).toBe(1);
  });

  it("returns -1 for a field on no page", () => {
    expect(pageIndexOfField(pages, "ghost")).toBe(-1);
  });
});

describe("resolveNextPage", () => {
  const fields = [
    field("f1", 1, { segmentId: "s1" }),
    field("f2", 1, { segmentId: "s2" }),
    field("f3", 1, { segmentId: "s3" }),
  ];
  const segments = [segment("s1", 1), segment("s2", 2), segment("s3", 3)];

  it("advances to the next page when no rule fires", () => {
    const flow = buildFlow(fields, segments);
    const pages = buildPages(flow, "SEGMENT_PER_PAGE");
    expect(resolveNextPage({ flow, pages, answers: {}, currentPageIndex: 0 })).toEqual({
      kind: "page",
      pageIndex: 1,
    });
  });

  it("ends after the last page", () => {
    const flow = buildFlow(fields, segments);
    const pages = buildPages(flow, "SEGMENT_PER_PAGE");
    expect(resolveNextPage({ flow, pages, answers: {}, currentPageIndex: 2 })).toEqual({
      kind: "end",
    });
  });

  it("ends when the current page index is out of range", () => {
    const flow = buildFlow(fields, segments);
    const pages = buildPages(flow, "SEGMENT_PER_PAGE");
    expect(resolveNextPage({ flow, pages, answers: {}, currentPageIndex: 99 })).toEqual({
      kind: "end",
    });
  });

  it("follows a jump to the page holding the target field", () => {
    const flow = buildFlow(fields, segments, [
      rule("r", "f1", {
        conditions: [condition("f1", "EQUALS", "skip")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "f3",
      }),
    ]);
    const pages = buildPages(flow, "SEGMENT_PER_PAGE");
    expect(
      resolveNextPage({ flow, pages, answers: { f1: "skip" }, currentPageIndex: 0 }),
    ).toEqual({ kind: "page", pageIndex: 2 });
  });

  it("ends when a rule on the page submits", () => {
    const flow = buildFlow(fields, segments, [
      rule("r", "f1", { conditions: [condition("f1", "IS_NOT_EMPTY")], action: "SUBMIT" }),
    ]);
    const pages = buildPages(flow, "SEGMENT_PER_PAGE");
    expect(resolveNextPage({ flow, pages, answers: { f1: "x" }, currentPageIndex: 0 })).toEqual({
      kind: "end",
    });
  });

  it("ignores a decision that lands back on the current page", () => {
    const twoOnOne = [
      field("a", 1, { segmentId: "s1" }),
      field("b", 2, { segmentId: "s1" }),
      field("c", 1, { segmentId: "s2" }),
    ];
    const segs = [segment("s1", 1), segment("s2", 2)];
    const flow = buildFlow(twoOnOne, segs, [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "b",
      }),
    ]);
    const pages = buildPages(flow, "SEGMENT_PER_PAGE");
    expect(resolveNextPage({ flow, pages, answers: { a: "x" }, currentPageIndex: 0 })).toEqual({
      kind: "page",
      pageIndex: 1,
    });
  });

  it("ends rather than returning to a page already visited", () => {
    const flow = buildFlow(fields, segments);
    const pages = buildPages(flow, "SEGMENT_PER_PAGE");
    expect(
      resolveNextPage({
        flow,
        pages,
        answers: {},
        currentPageIndex: 0,
        visitedPageIndexes: [1],
      }),
    ).toEqual({ kind: "end" });
  });
});

describe("estimateRemainingPages", () => {
  const fields = [
    field("f1", 1, { segmentId: "s1" }),
    field("f2", 1, { segmentId: "s2" }),
    field("f3", 1, { segmentId: "s3" }),
  ];
  const segments = [segment("s1", 1), segment("s2", 2), segment("s3", 3)];

  it("counts the pages left in a linear form", () => {
    const flow = buildFlow(fields, segments);
    const pages = buildPages(flow, "SEGMENT_PER_PAGE");
    expect(estimateRemainingPages({ flow, pages, answers: {}, currentPageIndex: 0 })).toBe(2);
    expect(estimateRemainingPages({ flow, pages, answers: {}, currentPageIndex: 2 })).toBe(0);
  });

  it("shrinks when a jump skips a page", () => {
    const flow = buildFlow(fields, segments, [
      rule("r", "f1", {
        conditions: [condition("f1", "EQUALS", "skip")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "f3",
      }),
    ]);
    const pages = buildPages(flow, "SEGMENT_PER_PAGE");
    expect(
      estimateRemainingPages({ flow, pages, answers: { f1: "skip" }, currentPageIndex: 0 }),
    ).toBe(1);
  });
});

/* ─── Malformed rules ──────────────────────────────────────────────────── */

describe("resolveRuleDecision — a rule the engine cannot act on", () => {
  const fields = [field("a", 1), field("b", 2), field("c", 3)];

  it("is ignored when its action is not one the engine implements", () => {
    const flow = buildFlow(fields, [], [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "TELEPORT" as unknown as FlowRule["action"],
      }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "x" }, fromFieldId: "a" })).toBeNull();
  });

  it("is ignored when its action is missing altogether", () => {
    const flow = buildFlow(fields, [], [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: null as unknown as FlowRule["action"],
      }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "x" }, fromFieldId: "a" })).toBeNull();
  });

  it("lets a later rule decide instead of swallowing the answer", () => {
    const flow = buildFlow(fields, [], [
      rule("broken", "a", {
        index: 1,
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "TELEPORT" as unknown as FlowRule["action"],
      }),
      rule("sound", "a", {
        index: 2,
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "c",
      }),
    ]);
    expect(resolveRuleDecision({ flow, answers: { a: "x" }, fromFieldId: "a" })).toEqual({
      kind: "field",
      fieldId: "c",
    });
  });

  it("falls through to the next question when every rule is unusable", () => {
    const flow = buildFlow(fields, [], [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "TELEPORT" as unknown as FlowRule["action"],
      }),
    ]);
    expect(resolveNextStep({ flow, answers: { a: "x" }, fromFieldId: "a" })).toEqual({
      kind: "field",
      fieldId: "b",
    });
  });
});
