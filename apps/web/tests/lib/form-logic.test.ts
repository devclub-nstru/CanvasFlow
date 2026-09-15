import { describe, expect, it } from "vitest";
import { buildFlow, type FlowCondition, type FlowField, type FlowRule, type FlowSegment, type LogicOperator } from "~/lib/form-flow";
import {
  ACTION_LABELS,
  OPERATOR_LABELS,
  choicesForField,
  describeCondition,
  describeRule,
  isRuleComplete,
  lintFlow,
  operatorsForFieldType,
  type FlowLabels,
} from "~/lib/form-logic";

const labels: FlowLabels = {
  fieldLabel: (id) => `«${id}»`,
  segmentLabel: (id) => `[${id}]`,
};

function field(id: string, index: number, extra: Partial<FlowField> = {}): FlowField {
  return { id, label: id, type: "SHORT_TEXT", isRequired: false, index, ...extra };
}

function segment(id: string, index: number): FlowSegment {
  return { id, title: id, index };
}

function condition(
  fieldId: string,
  operator: LogicOperator,
  value?: unknown,
  index = 0,
): FlowCondition {
  return { id: `c-${fieldId}-${index}`, fieldId, operator, value, index };
}

function rule(id: string, fieldId: string, extra: Partial<FlowRule> = {}): FlowRule {
  return { id, fieldId, match: "ALL", conditions: [], action: "CONTINUE", index: 0, ...extra };
}

/* ─── Vocabulary ───────────────────────────────────────────────────────── */

describe("label maps", () => {
  it("names every operator the flow engine understands", () => {
    const operators: LogicOperator[] = [
      "EQUALS",
      "NOT_EQUALS",
      "CONTAINS",
      "NOT_CONTAINS",
      "GREATER_THAN",
      "LESS_THAN",
      "IS_EMPTY",
      "IS_NOT_EMPTY",
      "IS_ANY_OF",
      "IS_NONE_OF",
      "STARTS_WITH",
      "ENDS_WITH",
    ];
    for (const operator of operators) {
      expect(OPERATOR_LABELS[operator], operator).toBeTruthy();
    }
    expect(Object.keys(OPERATOR_LABELS)).toHaveLength(operators.length);
  });

  it("names every action", () => {
    expect(Object.keys(ACTION_LABELS).sort()).toEqual([
      "CONTINUE",
      "JUMP_TO_FIELD",
      "JUMP_TO_SEGMENT",
      "REPEAT",
      "SUBMIT",
    ]);
  });
});

describe("operatorsForFieldType", () => {
  it("always offers the presence operators last", () => {
    for (const type of ["SELECT", "CHECKBOX", "NUMBER", "DATE", "TOGGLE", "SHORT_TEXT", undefined]) {
      expect(operatorsForFieldType(type).slice(-2)).toEqual(["IS_EMPTY", "IS_NOT_EMPTY"]);
    }
  });

  it("offers set operators but no substring matching for single choice", () => {
    const ops = operatorsForFieldType("RADIO");
    expect(ops).toContain("IS_ANY_OF");
    expect(ops).not.toContain("CONTAINS");
  });

  it("leads with membership for checkboxes, since the answer is a list", () => {
    expect(operatorsForFieldType("CHECKBOX")[0]).toBe("CONTAINS");
  });

  it("offers ordering for numeric and date-like types", () => {
    for (const type of ["NUMBER", "RATING", "SLIDER", "DATE", "TIME", "DATETIME"]) {
      expect(operatorsForFieldType(type), type).toContain("GREATER_THAN");
      expect(operatorsForFieldType(type), type).toContain("LESS_THAN");
    }
  });

  it("gives a toggle only equality and presence", () => {
    expect(operatorsForFieldType("TOGGLE")).toEqual(["EQUALS", "IS_EMPTY", "IS_NOT_EMPTY"]);
  });

  it("falls back to the full text set for unknown types", () => {
    const ops = operatorsForFieldType("SOMETHING_NEW");
    expect(ops).toContain("STARTS_WITH");
    expect(ops).toContain("ENDS_WITH");
    expect(ops).toEqual(operatorsForFieldType(undefined));
  });
});

describe("choicesForField", () => {
  it("reads a bare array of options", () => {
    expect(choicesForField({ options: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("reads the choices key of an options object", () => {
    expect(choicesForField({ options: { choices: ["a", 2] } })).toEqual(["a", "2"]);
  });

  it("returns nothing for a field with no usable options", () => {
    expect(choicesForField(undefined)).toEqual([]);
    expect(choicesForField({})).toEqual([]);
    expect(choicesForField({ options: null })).toEqual([]);
    expect(choicesForField({ options: "nope" })).toEqual([]);
    expect(choicesForField({ options: { choices: "nope" } })).toEqual([]);
  });
});

/* ─── Describing ───────────────────────────────────────────────────────── */

describe("describeCondition", () => {
  it("reads as a sentence fragment", () => {
    expect(describeCondition(condition("name", "EQUALS", "Ada"), labels)).toBe("«name» is “Ada”");
  });

  it("drops the value entirely for presence operators", () => {
    expect(describeCondition(condition("name", "IS_EMPTY"), labels)).toBe("«name» is blank");
    expect(describeCondition(condition("name", "IS_NOT_EMPTY"), labels)).toBe("«name» is answered");
  });

  it("joins a multi-value list with 'or'", () => {
    expect(describeCondition(condition("c", "IS_ANY_OF", ["a", "b"]), labels)).toBe(
      "«c» is any of “a” or “b”",
    );
  });

  it("shows a single-item list without the joiner", () => {
    expect(describeCondition(condition("c", "IS_ANY_OF", ["a"]), labels)).toBe("«c» is any of “a”");
  });

  it("shows a placeholder when the value has not been filled in", () => {
    expect(describeCondition(condition("c", "EQUALS", ""), labels)).toBe("«c» is …");
    expect(describeCondition(condition("c", "EQUALS", undefined), labels)).toBe("«c» is …");
    expect(describeCondition(condition("c", "IS_ANY_OF", []), labels)).toBe("«c» is any of …");
  });

  it("falls back to the raw operator name if it is unknown", () => {
    const bogus = condition("c", "WAT" as LogicOperator, "x");
    expect(describeCondition(bogus, labels)).toBe("«c» WAT “x”");
  });
});

describe("describeRule", () => {
  it("describes a single-condition rule without naming the joiner", () => {
    const r = rule("r", "a", {
      conditions: [condition("a", "EQUALS", "yes")],
      action: "SUBMIT",
    });
    expect(describeRule(r, labels)).toBe("If «a» is “yes” → finish the form");
  });

  it("names the joiner once there is more than one condition", () => {
    const r = rule("r", "a", {
      match: "ANY",
      conditions: [condition("a", "EQUALS", "yes"), condition("b", "IS_NOT_EMPTY")],
      action: "CONTINUE",
    });
    expect(describeRule(r, labels)).toBe(
      "If any of: «a» is “yes”, «b» is answered → continue in order",
    );
  });

  it("says so when the rule has no conditions yet", () => {
    expect(describeRule(rule("r", "a", { action: "SUBMIT" }), labels)).toBe(
      "If all of: no conditions yet → finish the form",
    );
  });

  it("appends the otherwise branch when there is one", () => {
    const r = rule("r", "a", {
      conditions: [condition("a", "IS_NOT_EMPTY")],
      action: "JUMP_TO_FIELD",
      targetFieldId: "b",
      elseAction: "JUMP_TO_SEGMENT",
      elseTargetSegmentId: "s1",
    });
    expect(describeRule(r, labels)).toBe(
      "If «a» is answered → go to «b», otherwise go to [s1]",
    );
  });

  it("shows a placeholder for a jump with no target chosen", () => {
    const r = rule("r", "a", {
      conditions: [condition("a", "IS_NOT_EMPTY")],
      action: "JUMP_TO_FIELD",
      targetFieldId: null,
    });
    expect(describeRule(r, labels)).toBe("If «a» is answered → go to …");
  });
});

/* ─── isRuleComplete ───────────────────────────────────────────────────── */

describe("isRuleComplete", () => {
  it("rejects a rule with no conditions", () => {
    expect(isRuleComplete(rule("r", "a", { action: "SUBMIT" }))).toBe(false);
  });

  it("accepts a valueless operator with no value", () => {
    expect(
      isRuleComplete(
        rule("r", "a", { conditions: [condition("a", "IS_EMPTY")], action: "SUBMIT" }),
      ),
    ).toBe(true);
  });

  it("requires a value for a comparison operator", () => {
    for (const value of [undefined, null, ""]) {
      expect(
        isRuleComplete(
          rule("r", "a", { conditions: [condition("a", "EQUALS", value)], action: "SUBMIT" }),
        ),
      ).toBe(false);
    }
    expect(
      isRuleComplete(
        rule("r", "a", { conditions: [condition("a", "EQUALS", 0)], action: "SUBMIT" }),
      ),
    ).toBe(true);
  });

  it("requires a non-empty list for a multi-value operator", () => {
    expect(
      isRuleComplete(
        rule("r", "a", { conditions: [condition("a", "IS_ANY_OF", [])], action: "SUBMIT" }),
      ),
    ).toBe(false);
    expect(
      isRuleComplete(
        rule("r", "a", { conditions: [condition("a", "IS_ANY_OF", "x")], action: "SUBMIT" }),
      ),
    ).toBe(false);
    expect(
      isRuleComplete(
        rule("r", "a", { conditions: [condition("a", "IS_ANY_OF", ["x"])], action: "SUBMIT" }),
      ),
    ).toBe(true);
  });

  it("requires a target for each jump side", () => {
    const base = { conditions: [condition("a", "IS_NOT_EMPTY")] };
    expect(
      isRuleComplete(rule("r", "a", { ...base, action: "JUMP_TO_FIELD", targetFieldId: null })),
    ).toBe(false);
    expect(
      isRuleComplete(rule("r", "a", { ...base, action: "JUMP_TO_SEGMENT", targetSegmentId: null })),
    ).toBe(false);
    expect(
      isRuleComplete(
        rule("r", "a", {
          ...base,
          action: "SUBMIT",
          elseAction: "JUMP_TO_FIELD",
          elseTargetFieldId: null,
        }),
      ),
    ).toBe(false);
    expect(
      isRuleComplete(
        rule("r", "a", {
          ...base,
          action: "SUBMIT",
          elseAction: "JUMP_TO_FIELD",
          elseTargetFieldId: "b",
        }),
      ),
    ).toBe(true);
  });
});

/* ─── lintFlow ─────────────────────────────────────────────────────────── */

describe("lintFlow", () => {
  const abc = [field("a", 1), field("b", 2), field("c", 3)];

  it("is silent on a form with no logic", () => {
    expect(lintFlow(buildFlow(abc), labels)).toEqual([]);
  });

  it("is silent on a well-formed forward jump", () => {
    const flow = buildFlow(abc, [], [
      rule("r", "a", {
        conditions: [condition("a", "EQUALS", "yes")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "c",
      }),
    ]);
    expect(lintFlow(flow, labels)).toEqual([]);
  });

  it("warns about a rule with no conditions", () => {
    const flow = buildFlow(abc, [], [rule("r", "a", { action: "SUBMIT" })]);
    const issues = lintFlow(flow, labels);
    expect(issues).toContainEqual({
      level: "warning",
      ruleId: "r",
      message: "A branch on «a» has no conditions, so it never runs.",
    });
  });

  it("errors when a condition has no value to compare against", () => {
    const flow = buildFlow(abc, [], [
      rule("r", "a", { conditions: [condition("a", "EQUALS", "")], action: "SUBMIT" }),
    ]);
    expect(lintFlow(flow, labels)).toContainEqual({
      level: "error",
      ruleId: "r",
      message: "A condition on «a» is missing the value to compare against.",
    });
  });

  it("errors when a condition reads a deleted question", () => {
    const flow = buildFlow(abc, [], [
      rule("r", "a", { conditions: [condition("deleted", "IS_NOT_EMPTY")], action: "SUBMIT" }),
    ]);
    expect(lintFlow(flow, labels)).toContainEqual({
      level: "error",
      ruleId: "r",
      message: "A branch on «a» reads a question that no longer exists.",
    });
  });

  it("errors when a jump has no destination", () => {
    const flow = buildFlow(abc, [], [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_FIELD",
        targetFieldId: null,
      }),
    ]);
    expect(lintFlow(flow, labels)).toContainEqual({
      level: "error",
      ruleId: "r",
      message: "A branch on «a» does not say where a match should go.",
    });
  });

  it("errors when the otherwise branch has no destination", () => {
    const flow = buildFlow(abc, [], [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "SUBMIT",
        elseAction: "JUMP_TO_SEGMENT",
        elseTargetSegmentId: null,
      }),
    ]);
    expect(lintFlow(flow, labels)).toContainEqual({
      level: "error",
      ruleId: "r",
      message: "The otherwise branch on «a» does not say where to go.",
    });
  });

  it("warns about a backwards jump, because the loop guard will end the form", () => {
    const flow = buildFlow(abc, [], [
      rule("r", "c", {
        conditions: [condition("c", "IS_NOT_EMPTY")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "a",
      }),
    ]);
    const issues = lintFlow(flow, labels);
    expect(issues.some((i) => i.level === "warning" && i.message.includes("jumps backwards"))).toBe(
      true,
    );
  });

  it("treats a jump to the field itself as backwards", () => {
    const flow = buildFlow(abc, [], [
      rule("r", "b", {
        conditions: [condition("b", "IS_NOT_EMPTY")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "b",
      }),
    ]);
    expect(
      lintFlow(flow, labels).some((i) => i.message.includes("jumps backwards")),
    ).toBe(true);
  });

  it("warns that a later branch is shadowed once an earlier one handles both outcomes", () => {
    const flow = buildFlow(abc, [], [
      rule("first", "a", {
        index: 1,
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "CONTINUE",
        elseAction: "CONTINUE",
      }),
      rule("second", "a", {
        index: 2,
        conditions: [condition("a", "EQUALS", "x")],
        action: "CONTINUE",
      }),
    ]);
    expect(lintFlow(flow, labels)).toContainEqual({
      level: "warning",
      ruleId: "second",
      message:
        "This branch never runs: an earlier branch on «a» already handles both outcomes.",
    });
  });

  it("does not call a branch shadowed when the earlier rule is itself incomplete", () => {
    const flow = buildFlow(abc, [], [
      rule("first", "a", {
        index: 1,
        conditions: [],
        action: "CONTINUE",
        elseAction: "CONTINUE",
      }),
      rule("second", "a", {
        index: 2,
        conditions: [condition("a", "EQUALS", "x")],
        action: "CONTINUE",
      }),
    ]);
    expect(lintFlow(flow, labels).some((i) => i.ruleId === "second")).toBe(false);
  });

  it("warns about a question no answer can reach", () => {
    const flow = buildFlow(abc, [], [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "c",
        elseAction: "JUMP_TO_FIELD",
        elseTargetFieldId: "c",
      }),
    ]);
    expect(lintFlow(flow, labels)).toContainEqual({
      level: "warning",
      fieldId: "b",
      message: "«b» can't be reached by any answer.",
    });
  });

  it("keeps the fall-through edge when a branch can continue in order", () => {
    const flow = buildFlow(abc, [], [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_FIELD",
        targetFieldId: "c",
        elseAction: "CONTINUE",
      }),
    ]);
    expect(lintFlow(flow, labels).some((i) => i.fieldId === "b")).toBe(false);
  });

  it("counts a segment jump as reaching the segment's first field", () => {
    const fields = [
      field("a", 1),
      field("s1f", 1, { segmentId: "s1" }),
      field("s2f", 1, { segmentId: "s2" }),
    ];
    const flow = buildFlow(fields, [segment("s1", 1), segment("s2", 2)], [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_SEGMENT",
        targetSegmentId: "s2",
        elseAction: "JUMP_TO_SEGMENT",
        elseTargetSegmentId: "s1",
      }),
    ]);
    expect(lintFlow(flow, labels).some((i) => i.level === "warning" && i.fieldId)).toBe(false);
  });

  it("reports nothing at all for an empty flow", () => {
    expect(lintFlow(buildFlow([]), labels)).toEqual([]);
  });
});

/* ─── Malformed rules ──────────────────────────────────────────────────── */

describe("describeRule — an action the vocabulary has no words for", () => {
  it("describes the condition and leaves the outcome blank", () => {
    const r = rule("r", "a", {
      conditions: [condition("a", "IS_NOT_EMPTY")],
      action: "TELEPORT" as unknown as FlowRule["action"],
    });
    expect(describeRule(r, labels)).toBe("If «a» is answered → ");
  });

  it("still describes the otherwise branch when only the then side is unknown", () => {
    const r = rule("r", "a", {
      conditions: [condition("a", "IS_NOT_EMPTY")],
      action: "TELEPORT" as unknown as FlowRule["action"],
      elseAction: "SUBMIT",
    });
    expect(describeRule(r, labels)).toBe("If «a» is answered → , otherwise finish the form");
  });
});

describe("lintFlow — a segment jump that leads nowhere", () => {
  it("does not treat an empty trailing segment as reaching anything", () => {
    const fields = [field("a", 1), field("s1f", 1, { segmentId: "s1" })];
    const flow = buildFlow(fields, [segment("s1", 1), segment("empty", 2)], [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_SEGMENT",
        targetSegmentId: "empty",
        elseAction: "JUMP_TO_SEGMENT",
        elseTargetSegmentId: "empty",
      }),
    ]);

    /* Both branches lead to a segment with no questions in it or after it, so
     * the only question in the form becomes unreachable. */
    expect(lintFlow(flow, labels)).toContainEqual({
      level: "warning",
      fieldId: "s1f",
      message: "«s1f» can't be reached by any answer.",
    });
  });

  it("does not crash on a jump to a segment that was deleted", () => {
    const fields = [field("a", 1), field("b", 2)];
    const flow = buildFlow(fields, [segment("s1", 1)], [
      rule("r", "a", {
        conditions: [condition("a", "IS_NOT_EMPTY")],
        action: "JUMP_TO_SEGMENT",
        targetSegmentId: "ghost",
      }),
    ]);
    expect(() => lintFlow(flow, labels)).not.toThrow();
  });
});

/* ─── Answer again ─────────────────────────────────────────────────────── */

describe("the REPEAT action", () => {
  it("reads as asking the question again", () => {
    const r = rule("r", "a", {
      conditions: [condition("a", "CONTAINS", "@company.com")],
      action: "CONTINUE",
      elseAction: "REPEAT",
    });

    expect(describeRule(r, labels)).toBe(
      "If «a» contains “@company.com” → continue in order, otherwise ask it again",
    );
  });

  it("needs no target to be a complete rule", () => {
    const r = rule("r", "a", {
      conditions: [condition("a", "IS_NOT_EMPTY")],
      action: "CONTINUE",
      elseAction: "REPEAT",
    });

    expect(isRuleComplete(r)).toBe(true);
  });

  it("flags a rule that repeats whatever the answer is, since nobody could pass it", () => {
    const flow = buildFlow(
      [field("a", 1), field("b", 2)],
      [],
      [
        rule("r", "a", {
          conditions: [condition("a", "IS_NOT_EMPTY")],
          action: "REPEAT",
          elseAction: "REPEAT",
        }),
      ],
    );

    const issue = lintFlow(flow, labels).find((i) => i.message.includes("never move on"));
    expect(issue?.level).toBe("error");
  });

  it("does not flag the ordinary gate, where one side still moves on", () => {
    const flow = buildFlow(
      [field("a", 1), field("b", 2)],
      [],
      [
        rule("r", "a", {
          conditions: [condition("a", "CONTAINS", "@company.com")],
          action: "CONTINUE",
          elseAction: "REPEAT",
        }),
      ],
    );

    expect(lintFlow(flow, labels)).toEqual([]);
  });

  it("leaves the following question reachable, unlike a branch that always jumps away", () => {
    const flow = buildFlow(
      [field("a", 1), field("b", 2)],
      [],
      [
        rule("r", "a", {
          conditions: [condition("a", "IS_NOT_EMPTY")],
          action: "REPEAT",
          elseAction: "REPEAT",
        }),
      ],
    );

    expect(lintFlow(flow, labels).some((i) => i.message.includes("can't be reached"))).toBe(false);
  });
});
