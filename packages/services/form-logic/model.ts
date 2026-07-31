import { z } from "zod";

/** Mirrors `logicOperatorEnum` in packages/database/models/form-logic.ts. */
export const logicOperatorZodEnum = z.enum([
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
export type LogicOperator = z.infer<typeof logicOperatorZodEnum>;

/** Mirrors `logicMatchEnum`. ALL = every condition, ANY = at least one. */
export const logicMatchZodEnum = z.enum(["ALL", "ANY"]);
export type LogicMatch = z.infer<typeof logicMatchZodEnum>;

/** Mirrors `logicActionEnum`. */
export const logicActionZodEnum = z.enum([
  "JUMP_TO_FIELD",
  "JUMP_TO_SEGMENT",
  "SUBMIT",
  "CONTINUE",
]);
export type LogicAction = z.infer<typeof logicActionZodEnum>;

/** Operators that test presence and therefore take no operand. */
export const VALUELESS_OPERATORS: readonly LogicOperator[] = ["IS_EMPTY", "IS_NOT_EMPTY"];

/** Operators whose operand is a list of choices rather than a single value. */
export const MULTI_VALUE_OPERATORS: readonly LogicOperator[] = ["IS_ANY_OF", "IS_NONE_OF"];

/** Actions that carry no destination. */
export const TARGETLESS_ACTIONS: readonly LogicAction[] = ["SUBMIT", "CONTINUE"];

/* ─── Conditions ──────────────────────────────────────────────────────── */

export const logicConditionInput = z.object({
  fieldId: z
    .string()
    .uuid()
    .describe("Question whose answer this condition reads — any question in the form"),
  operator: logicOperatorZodEnum.describe("How the answer is compared"),
  value: z
    .any()
    .optional()
    .nullable()
    .describe("Operand; omitted for IS_EMPTY / IS_NOT_EMPTY, an array for IS_ANY_OF / IS_NONE_OF"),
  index: z
    .union([z.number(), z.string()])
    .transform((val) => String(val))
    .optional()
    .describe("Display order within the rule"),
});
export type LogicConditionInputType = z.infer<typeof logicConditionInput>;

export const logicConditionOutput = z.object({
  id: z.string().uuid(),
  ruleId: z.string().uuid(),
  fieldId: z.string().uuid(),
  operator: logicOperatorZodEnum,
  value: z.any().nullable().optional(),
  index: z.string(),
  createdAt: z.any(),
  updatedAt: z.any(),
});
export type LogicConditionOutputType = z.infer<typeof logicConditionOutput>;

/* ─── Validation ──────────────────────────────────────────────────────── */

/**
 * Check one condition's operator/value pairing.
 *
 * A plain function, not a Zod `.superRefine()`. It has to be: the tRPC layer
 * feeds every procedure's input schema to `trpc-to-openapi`, which calls
 * `.omit()` on it to build the request body, and zod 4 rejects `.omit()` on
 * any schema carrying a refinement — so one refined input schema takes down
 * the whole API at startup, not just its own route.
 *
 * The CHECK constraints in Postgres are what actually guarantee no bad row can
 * exist. This exists so the author gets "pick at least one option" rather than
 * `violates check constraint "form_logic_conditions_value_matches_operator"`.
 */
export function assertConditionShape(condition: {
  operator: LogicOperator;
  value?: unknown;
}): void {
  const { operator, value } = condition;

  if (VALUELESS_OPERATORS.includes(operator)) {
    if (value !== undefined && value !== null && value !== "") {
      throw new Error(
        `${operator} checks whether an answer exists, so it must not carry a comparison value`,
      );
    }
    return;
  }

  if (MULTI_VALUE_OPERATORS.includes(operator)) {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(`${operator} needs at least one option to compare against`);
    }
    return;
  }

  if (value === undefined || value === null || value === "") {
    throw new Error(`${operator} needs a value to compare the answer against`);
  }
}

/**
 * Check a branch's then/else sides.
 *
 * `elseAction` is optional throughout: a rule without one is a guard clause
 * ("if they said no, skip ahead") that stays out of the way when its
 * conditions don't hold, and the next rule gets a turn. A rule with one is a
 * fork that always decides.
 */
export function assertRuleShape(rule: {
  fieldId?: string;
  action: LogicAction;
  targetFieldId?: string | null;
  targetSegmentId?: string | null;
  elseAction?: LogicAction | null;
  elseTargetFieldId?: string | null;
  elseTargetSegmentId?: string | null;
}): void {
  const {
    fieldId,
    action,
    targetFieldId,
    targetSegmentId,
    elseAction,
    elseTargetFieldId,
    elseTargetSegmentId,
  } = rule;

  const checkSide = (
    side: "then" | "otherwise",
    sideAction: LogicAction,
    fieldTarget?: string | null,
    segmentTarget?: string | null,
  ) => {
    const label = side === "then" ? "the matching branch" : "the otherwise branch";

    if (sideAction === "JUMP_TO_FIELD") {
      if (!fieldTarget) throw new Error(`Choose the question ${label} jumps to`);
      if (segmentTarget) throw new Error(`${label} cannot target both a question and a segment`);
      return;
    }
    if (sideAction === "JUMP_TO_SEGMENT") {
      if (!segmentTarget) throw new Error(`Choose the segment ${label} jumps to`);
      if (fieldTarget) throw new Error(`${label} cannot target both a question and a segment`);
      return;
    }
    if (fieldTarget || segmentTarget) {
      throw new Error(`${label} ends the flow, so it cannot also have a jump target`);
    }
  };

  checkSide("then", action, targetFieldId, targetSegmentId);

  if (elseAction) {
    checkSide("otherwise", elseAction, elseTargetFieldId, elseTargetSegmentId);
  } else if (elseTargetFieldId || elseTargetSegmentId) {
    throw new Error("Set what the otherwise branch does before choosing where it goes");
  }

  if (fieldId && targetFieldId === fieldId) {
    throw new Error("A question cannot branch back to itself");
  }
  if (fieldId && elseTargetFieldId === fieldId) {
    throw new Error("A question cannot branch back to itself");
  }
}

/* ─── Rules ───────────────────────────────────────────────────────────── */

/* Both input schemas are plain objects with no refinements — see the note on
 * `assertConditionShape` for why. The service validates after parsing. */

export const createLogicRuleInput = z
  .object({
    formId: z.string().uuid().describe("ID of the parent form"),
    fieldId: z.string().uuid().describe("Question after which this branch is evaluated"),
    match: logicMatchZodEnum
      .default("ALL")
      .describe("ALL = every condition must hold, ANY = at least one"),
    conditions: z
      .array(logicConditionInput)
      .default([])
      .describe("Tests combined per `match`; a branch with none never matches"),

    action: logicActionZodEnum.describe("Where a match sends the respondent"),
    targetFieldId: z.string().uuid().optional().nullable().describe("Destination question"),
    targetSegmentId: z.string().uuid().optional().nullable().describe("Destination segment"),

    elseAction: logicActionZodEnum
      .optional()
      .nullable()
      .describe("Where a non-match goes; omit to fall through to the next rule"),
    elseTargetFieldId: z.string().uuid().optional().nullable(),
    elseTargetSegmentId: z.string().uuid().optional().nullable(),

    index: z
      .union([z.number(), z.string()])
      .transform((val) => String(val))
      .optional()
      .describe("Evaluation order for the trigger question's rules; lower wins"),
  })
  .describe("Create a conditional branch");
export type CreateLogicRuleInputType = z.infer<typeof createLogicRuleInput>;

export const updateLogicRuleInput = z
  .object({
    id: z.string().uuid().describe("ID of the rule to update"),
    match: logicMatchZodEnum.optional(),
    // Supplying this replaces the rule's whole condition set. Omitting it
    // leaves the conditions untouched, so a rename-only edit doesn't have to
    // round-trip them.
    conditions: z
      .array(logicConditionInput)
      .optional()
      .describe("Replaces every condition on the rule when supplied"),

    action: logicActionZodEnum.optional(),
    targetFieldId: z.string().uuid().optional().nullable(),
    targetSegmentId: z.string().uuid().optional().nullable(),

    elseAction: logicActionZodEnum.optional().nullable(),
    elseTargetFieldId: z.string().uuid().optional().nullable(),
    elseTargetSegmentId: z.string().uuid().optional().nullable(),

    index: z
      .union([z.number(), z.string()])
      .transform((val) => String(val))
      .optional(),
    expectedVersion: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Optimistic-lock token returned by the previous read of this rule"),
  })
  .describe("Update a conditional branch");
export type UpdateLogicRuleInputType = z.infer<typeof updateLogicRuleInput>;

export const deleteLogicRuleInput = z.object({
  id: z.string().uuid().describe("ID of the rule to delete"),
});
export type DeleteLogicRuleInputType = z.infer<typeof deleteLogicRuleInput>;

export const listLogicRulesInput = z.object({
  formId: z.string().uuid().describe("ID of the parent form"),
});
export type ListLogicRulesInputType = z.infer<typeof listLogicRulesInput>;

export const getLogicRuleOutput = z.object({
  id: z.string().uuid(),
  formId: z.string().uuid(),
  fieldId: z.string().uuid().describe("Question after which this branch is evaluated"),
  match: logicMatchZodEnum,
  conditions: z.array(logicConditionOutput),

  action: logicActionZodEnum,
  targetFieldId: z.string().uuid().nullable().optional(),
  targetSegmentId: z.string().uuid().nullable().optional(),

  elseAction: logicActionZodEnum.nullable().optional(),
  elseTargetFieldId: z.string().uuid().nullable().optional(),
  elseTargetSegmentId: z.string().uuid().nullable().optional(),

  index: z.string(),
  version: z.number().int(),
  createdAt: z.any(),
  updatedAt: z.any(),
});
export type GetLogicRuleOutputType = z.infer<typeof getLogicRuleOutput>;

export const listLogicRulesOutput = z.array(getLogicRuleOutput);
export type ListLogicRulesOutputType = z.infer<typeof listLogicRulesOutput>;

export const createLogicRuleOutput = z.object({
  id: z.string().uuid().describe("ID of the created rule"),
  index: z.string().describe("Fractional index the rule was created at"),
});
export type CreateLogicRuleOutputType = z.infer<typeof createLogicRuleOutput>;

export const updateLogicRuleOutput = z.object({
  id: z.string().uuid(),
  version: z.number().int().describe("New optimistic-lock version after the update"),
});
export type UpdateLogicRuleOutputType = z.infer<typeof updateLogicRuleOutput>;

export const deleteLogicRuleOutput = z.object({
  success: z.boolean(),
});
export type DeleteLogicRuleOutputType = z.infer<typeof deleteLogicRuleOutput>;
