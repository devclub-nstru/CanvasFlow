import { describe, expect, it } from "vitest";
import {
  MULTI_VALUE_OPERATORS,
  TARGETLESS_ACTIONS,
  VALUELESS_OPERATORS,
  assertConditionShape,
  assertRuleShape,
  createLogicRuleInput,
  deleteLogicRuleInput,
  listLogicRulesInput,
  logicActionZodEnum,
  logicConditionInput,
  logicMatchZodEnum,
  logicOperatorZodEnum,
  updateLogicRuleInput,
  type LogicAction,
  type LogicOperator,
} from "@repo/services/form-logic/model";

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const OTHER_UUID = "223e4567-e89b-12d3-a456-426614174001";

/* ─── Vocabulary ───────────────────────────────────────────────────────── */

describe("logic enums", () => {
  it("lists exactly the twelve operators the flow engine implements", () => {
    expect(logicOperatorZodEnum.options).toEqual([
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
    ]);
  });

  it("lists both match modes and every action", () => {
    expect(logicMatchZodEnum.options).toEqual(["ALL", "ANY"]);
    expect(logicActionZodEnum.options).toEqual([
      "JUMP_TO_FIELD",
      "JUMP_TO_SEGMENT",
      "SUBMIT",
      "CONTINUE",
      "REPEAT",
    ]);
  });

  it("classifies the special operators and actions", () => {
    expect([...VALUELESS_OPERATORS]).toEqual(["IS_EMPTY", "IS_NOT_EMPTY"]);
    expect([...MULTI_VALUE_OPERATORS]).toEqual(["IS_ANY_OF", "IS_NONE_OF"]);
    expect([...TARGETLESS_ACTIONS]).toEqual(["SUBMIT", "CONTINUE", "REPEAT"]);
  });

  it("only classifies operators that actually exist", () => {
    for (const operator of [...VALUELESS_OPERATORS, ...MULTI_VALUE_OPERATORS]) {
      expect(logicOperatorZodEnum.options).toContain(operator);
    }
    for (const action of TARGETLESS_ACTIONS) {
      expect(logicActionZodEnum.options).toContain(action);
    }
  });
});

/* ─── assertConditionShape ─────────────────────────────────────────────── */

describe("assertConditionShape — presence operators", () => {
  it.each(VALUELESS_OPERATORS)("accepts %s with no value", (operator) => {
    expect(() => assertConditionShape({ operator })).not.toThrow();
    expect(() => assertConditionShape({ operator, value: null })).not.toThrow();
    expect(() => assertConditionShape({ operator, value: "" })).not.toThrow();
  });

  it.each(VALUELESS_OPERATORS)("rejects %s carrying a value", (operator) => {
    expect(() => assertConditionShape({ operator, value: "x" })).toThrow(
      /must not carry a comparison value/,
    );
  });

  it("rejects a presence operator carrying a falsy-but-present value", () => {
    expect(() => assertConditionShape({ operator: "IS_EMPTY", value: 0 })).toThrow();
    expect(() => assertConditionShape({ operator: "IS_EMPTY", value: false })).toThrow();
  });
});

describe("assertConditionShape — set operators", () => {
  it.each(MULTI_VALUE_OPERATORS)("accepts %s with a non-empty array", (operator) => {
    expect(() => assertConditionShape({ operator, value: ["a"] })).not.toThrow();
  });

  it.each(MULTI_VALUE_OPERATORS)("rejects %s with an empty array", (operator) => {
    expect(() => assertConditionShape({ operator, value: [] })).toThrow(
      /needs at least one option/,
    );
  });

  it.each(MULTI_VALUE_OPERATORS)("rejects %s with a bare scalar", (operator) => {
    expect(() => assertConditionShape({ operator, value: "a" })).toThrow();
    expect(() => assertConditionShape({ operator })).toThrow();
  });
});

describe("assertConditionShape — comparison operators", () => {
  const comparisons: LogicOperator[] = [
    "EQUALS",
    "NOT_EQUALS",
    "CONTAINS",
    "NOT_CONTAINS",
    "GREATER_THAN",
    "LESS_THAN",
    "STARTS_WITH",
    "ENDS_WITH",
  ];

  it.each(comparisons)("accepts %s with a value", (operator) => {
    expect(() => assertConditionShape({ operator, value: "x" })).not.toThrow();
  });

  it.each(comparisons)("rejects %s with nothing to compare against", (operator) => {
    for (const value of [undefined, null, ""]) {
      expect(() => assertConditionShape({ operator, value })).toThrow(/needs a value/);
    }
  });

  it("accepts a value that is falsy but meaningful", () => {
    expect(() => assertConditionShape({ operator: "EQUALS", value: 0 })).not.toThrow();
    expect(() => assertConditionShape({ operator: "EQUALS", value: false })).not.toThrow();
  });
});

/* ─── assertRuleShape ──────────────────────────────────────────────────── */

describe("assertRuleShape — the matching branch", () => {
  it("accepts a field jump with a field target", () => {
    expect(() =>
      assertRuleShape({ action: "JUMP_TO_FIELD", targetFieldId: UUID }),
    ).not.toThrow();
  });

  it("rejects a field jump with no target", () => {
    expect(() => assertRuleShape({ action: "JUMP_TO_FIELD" })).toThrow(
      /Choose the question the matching branch jumps to/,
    );
  });

  it("rejects a field jump that also names a segment", () => {
    expect(() =>
      assertRuleShape({
        action: "JUMP_TO_FIELD",
        targetFieldId: UUID,
        targetSegmentId: OTHER_UUID,
      }),
    ).toThrow(/cannot target both/);
  });

  it("accepts a segment jump with a segment target", () => {
    expect(() =>
      assertRuleShape({ action: "JUMP_TO_SEGMENT", targetSegmentId: UUID }),
    ).not.toThrow();
  });

  it("rejects a segment jump with no target", () => {
    expect(() => assertRuleShape({ action: "JUMP_TO_SEGMENT" })).toThrow(
      /Choose the segment the matching branch jumps to/,
    );
  });

  it("rejects a segment jump that also names a field", () => {
    expect(() =>
      assertRuleShape({
        action: "JUMP_TO_SEGMENT",
        targetSegmentId: UUID,
        targetFieldId: OTHER_UUID,
      }),
    ).toThrow(/cannot target both/);
  });

  it.each(TARGETLESS_ACTIONS)("accepts %s with no target at all", (action) => {
    expect(() => assertRuleShape({ action })).not.toThrow();
  });

  it.each(TARGETLESS_ACTIONS)("rejects %s carrying a stale target", (action) => {
    expect(() => assertRuleShape({ action, targetFieldId: UUID })).toThrow(
      /does not go anywhere, so it cannot also have a jump target/,
    );
    expect(() => assertRuleShape({ action, targetSegmentId: UUID })).toThrow();
  });
});

describe("assertRuleShape — the otherwise branch", () => {
  const then = { action: "SUBMIT" as LogicAction };

  it("accepts a well-formed else jump", () => {
    expect(() =>
      assertRuleShape({ ...then, elseAction: "JUMP_TO_FIELD", elseTargetFieldId: UUID }),
    ).not.toThrow();
  });

  it("applies the same rules to the else side, with its own wording", () => {
    expect(() => assertRuleShape({ ...then, elseAction: "JUMP_TO_FIELD" })).toThrow(
      /the otherwise branch jumps to/,
    );
    expect(() => assertRuleShape({ ...then, elseAction: "JUMP_TO_SEGMENT" })).toThrow(
      /the otherwise branch jumps to/,
    );
    expect(() =>
      assertRuleShape({ ...then, elseAction: "SUBMIT", elseTargetFieldId: UUID }),
    ).toThrow(/the otherwise branch does not go anywhere/);
  });

  it("rejects an else target with no else action", () => {
    expect(() => assertRuleShape({ ...then, elseTargetFieldId: UUID })).toThrow(
      /Set what the otherwise branch does before choosing where it goes/,
    );
    expect(() => assertRuleShape({ ...then, elseTargetSegmentId: UUID })).toThrow();
  });

  it("accepts a rule with no else branch at all", () => {
    expect(() => assertRuleShape(then)).not.toThrow();
  });
});

describe("assertRuleShape — self reference", () => {
  it("refuses a branch that jumps back to its own question", () => {
    expect(() =>
      assertRuleShape({ fieldId: UUID, action: "JUMP_TO_FIELD", targetFieldId: UUID }),
    ).toThrow(/cannot branch back to itself/);
  });

  it("refuses an otherwise branch that jumps back to its own question", () => {
    expect(() =>
      assertRuleShape({
        fieldId: UUID,
        action: "SUBMIT",
        elseAction: "JUMP_TO_FIELD",
        elseTargetFieldId: UUID,
      }),
    ).toThrow(/cannot branch back to itself/);
  });

  it("allows a jump to a different question", () => {
    expect(() =>
      assertRuleShape({ fieldId: UUID, action: "JUMP_TO_FIELD", targetFieldId: OTHER_UUID }),
    ).not.toThrow();
  });

  it("skips the check when the rule does not say which question it hangs off", () => {
    expect(() =>
      assertRuleShape({ action: "JUMP_TO_FIELD", targetFieldId: UUID }),
    ).not.toThrow();
  });
});

/* ─── Schemas ──────────────────────────────────────────────────────────── */

describe("logicConditionInput", () => {
  it("accepts a minimal condition", () => {
    const parsed = logicConditionInput.parse({ fieldId: UUID, operator: "IS_EMPTY" });
    expect(parsed.fieldId).toBe(UUID);
    expect(parsed.operator).toBe("IS_EMPTY");
  });

  it("requires a UUID field id", () => {
    expect(logicConditionInput.safeParse({ fieldId: "nope", operator: "EQUALS" }).success).toBe(
      false,
    );
  });

  it("rejects an operator the flow engine does not implement", () => {
    expect(
      logicConditionInput.safeParse({ fieldId: UUID, operator: "SOUNDS_LIKE" }).success,
    ).toBe(false);
  });

  it("normalises a numeric index to a string, so ordering stays lexical", () => {
    expect(logicConditionInput.parse({ fieldId: UUID, operator: "IS_EMPTY", index: 2 }).index).toBe(
      "2",
    );
    expect(
      logicConditionInput.parse({ fieldId: UUID, operator: "IS_EMPTY", index: "1.5" }).index,
    ).toBe("1.5");
  });

  it("accepts any operand shape, since the operator decides what is meaningful", () => {
    for (const value of ["x", 3, true, ["a", "b"], null]) {
      expect(
        logicConditionInput.safeParse({ fieldId: UUID, operator: "EQUALS", value }).success,
      ).toBe(true);
    }
  });
});

describe("createLogicRuleInput", () => {
  const minimal = { formId: UUID, fieldId: OTHER_UUID, action: "SUBMIT" };

  it("accepts a minimal rule and fills in the defaults", () => {
    const parsed = createLogicRuleInput.parse(minimal);
    expect(parsed.match).toBe("ALL");
    expect(parsed.conditions).toEqual([]);
  });

  it.each(["formId", "fieldId", "action"])("requires %s", (key) => {
    const input: Record<string, unknown> = { ...minimal };
    delete input[key];
    expect(createLogicRuleInput.safeParse(input).success).toBe(false);
  });

  it.each(["formId", "fieldId", "targetFieldId", "targetSegmentId"])(
    "requires %s to be a UUID when present",
    (key) => {
      expect(createLogicRuleInput.safeParse({ ...minimal, [key]: "nope" }).success).toBe(false);
    },
  );

  it("accepts an explicitly null optional target", () => {
    expect(
      createLogicRuleInput.safeParse({ ...minimal, targetFieldId: null, elseAction: null }).success,
    ).toBe(true);
  });

  it("rejects an unknown match mode or action", () => {
    expect(createLogicRuleInput.safeParse({ ...minimal, match: "SOME" }).success).toBe(false);
    expect(createLogicRuleInput.safeParse({ ...minimal, action: "EXPLODE" }).success).toBe(false);
  });

  it("validates the conditions it carries", () => {
    expect(
      createLogicRuleInput.safeParse({
        ...minimal,
        conditions: [{ fieldId: "nope", operator: "EQUALS" }],
      }).success,
    ).toBe(false);
  });

  it("normalises the rule index to a string", () => {
    expect(createLogicRuleInput.parse({ ...minimal, index: 3 }).index).toBe("3");
  });
});

describe("updateLogicRuleInput", () => {
  it("requires only the id", () => {
    expect(updateLogicRuleInput.safeParse({ id: UUID }).success).toBe(true);
  });

  it("rejects a non-UUID id", () => {
    expect(updateLogicRuleInput.safeParse({ id: "nope" }).success).toBe(false);
  });

  it("accepts an optimistic-lock token that is a non-negative integer", () => {
    expect(updateLogicRuleInput.safeParse({ id: UUID, expectedVersion: 0 }).success).toBe(true);
    expect(updateLogicRuleInput.safeParse({ id: UUID, expectedVersion: -1 }).success).toBe(false);
    expect(updateLogicRuleInput.safeParse({ id: UUID, expectedVersion: 1.5 }).success).toBe(false);
  });
});

describe("the remaining rule schemas", () => {
  it("delete and list both require a UUID", () => {
    expect(deleteLogicRuleInput.safeParse({ id: UUID }).success).toBe(true);
    expect(deleteLogicRuleInput.safeParse({ id: "nope" }).success).toBe(false);
    expect(listLogicRulesInput.safeParse({ formId: UUID }).success).toBe(true);
    expect(listLogicRulesInput.safeParse({}).success).toBe(false);
  });
});
