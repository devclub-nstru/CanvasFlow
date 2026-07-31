import {
  pgTable,
  uuid,
  timestamp,
  integer,
  numeric,
  jsonb,
  pgEnum,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { formsTable } from "./form";
import { formFieldsTable } from "./form-field";
import { formSegmentsTable } from "./form-segment";

/**
 * How a single condition compares a respondent's answer against `value`.
 *
 * IS_EMPTY / IS_NOT_EMPTY ignore `value` entirely, which is why the column is
 * nullable. IS_ANY_OF / IS_NONE_OF take an array and are the operators an
 * author actually wants for "sent to the enterprise branch if they picked any
 * of these three plans" — expressing that with EQUALS means three near-
 * duplicate rules that have to be kept in sync.
 */
export const logicOperatorEnum = pgEnum("logic_operator", [
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

/** Whether every condition on a rule has to hold, or just one of them. */
export const logicMatchEnum = pgEnum("logic_match", ["ALL", "ANY"]);

/**
 * Where a branch sends the respondent.
 *
 * JUMP_TO_FIELD is "ask that question next". JUMP_TO_SEGMENT is "send them to
 * that page". SUBMIT ends the form early, which dead-end branches need —
 * without it a "not interested" answer has to be padded with filler questions
 * to reach the end. CONTINUE means "carry on in normal order" and exists so
 * the *else* side of a branch can be stated explicitly rather than left to be
 * inferred from its absence.
 */
export const logicActionEnum = pgEnum("logic_action", [
  "JUMP_TO_FIELD",
  "JUMP_TO_SEGMENT",
  "SUBMIT",
  "CONTINUE",
]);

/**
 * One branch: "after question X, if <conditions> then go here, otherwise go
 * there".
 *
 * The conditions live in `form_logic_conditions`, one row each, so a branch can
 * weigh several answers at once ("plan is Pro AND team size is over 50").
 * They're a child table rather than a jsonb array on this row for one reason
 * that matters: each condition names a question, and that reference needs a
 * real foreign key. Deleting a question then removes the conditions that read
 * it, instead of leaving a rule quietly testing an id that no longer exists.
 *
 * Three field references, doing three different jobs, which is worth keeping
 * straight:
 *   · `field_id`                     — WHEN to evaluate. The rule is checked
 *                                      after this question is answered.
 *   · `form_logic_conditions.field_id` — WHAT to read. Any question in the
 *                                      form, not just the trigger.
 *   · `target_field_id` / `else_...`  — WHERE to go.
 *
 * Evaluation is first-decision-wins in `index` order. A rule whose conditions
 * hold takes its `action`. A rule whose conditions fail takes `else_action` if
 * one is set, and is otherwise skipped so the next rule gets a turn. That
 * distinction is the whole point of a nullable else: a rule with no else is a
 * guard clause, a rule with one is a fork.
 */
export const formLogicRulesTable = pgTable(
  "form_logic_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Denormalised from `form_fields.form_id` so the public form read can
    // fetch every rule for a form in one indexed query, without joining
    // through fields just to scope by form.
    formId: uuid("form_id")
      .references(() => formsTable.id, {
        onDelete: "cascade",
      })
      .notNull(),

    // The question after which this rule is evaluated.
    fieldId: uuid("field_id")
      .references(() => formFieldsTable.id, {
        onDelete: "cascade",
      })
      .notNull(),

    match: logicMatchEnum("match").notNull().default("ALL"),

    /* ── the "then" side ── */
    action: logicActionEnum("action").notNull(),
    targetFieldId: uuid("target_field_id").references(() => formFieldsTable.id, {
      onDelete: "cascade",
    }),
    targetSegmentId: uuid("target_segment_id").references(() => formSegmentsTable.id, {
      onDelete: "cascade",
    }),

    /* ── the "otherwise" side. NULL means "no opinion, try the next rule". ── */
    elseAction: logicActionEnum("else_action"),
    elseTargetFieldId: uuid("else_target_field_id").references(() => formFieldsTable.id, {
      onDelete: "cascade",
    }),
    elseTargetSegmentId: uuid("else_target_segment_id").references(() => formSegmentsTable.id, {
      onDelete: "cascade",
    }),

    index: numeric("index", { scale: 2 }).notNull(),

    // Optimistic-lock counter (see comment on forms.version)
    version: integer("version").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => {
    return {
      // Public form read: every rule for a form, ordered by index.
      formIdx: index("form_logic_rules_form_idx").on(table.formId),
      // Builder: the rules triggered by one selected question.
      fieldIdx: index("form_logic_rules_field_idx").on(table.fieldId, table.index),

      // A branch's target has to match its action, enforced here and not only
      // in Zod. A JUMP_TO_SEGMENT with a null target_segment_id is not a
      // harmless bad row: the resolver would decide the branch was taken, fail
      // to resolve a destination, and drop the respondent mid-form. The
      // database is the only place that can rule that out whatever writes it.
      /* Both checks are phrased as "not one of the jump actions" rather than
       * "is SUBMIT or CONTINUE", and that is not a style choice. Postgres
       * refuses to evaluate a value added by ALTER TYPE ... ADD VALUE until
       * the adding transaction commits, and drizzle applies every pending
       * migration inside ONE transaction — so a constraint naming 'CONTINUE'
       * in the same migration that introduces it fails with
       * `unsafe use of new value` (55P04), and no amount of splitting the
       * files avoids it. Naming only the long-standing values sidesteps the
       * problem entirely, and has the side benefit that a future action which
       * carries no target is covered without touching these constraints. */
      targetMatchesAction: check(
        "form_logic_rules_target_matches_action",
        sql`(
          (${table.action} = 'JUMP_TO_FIELD' AND ${table.targetFieldId} IS NOT NULL AND ${table.targetSegmentId} IS NULL)
          OR (${table.action} = 'JUMP_TO_SEGMENT' AND ${table.targetSegmentId} IS NOT NULL AND ${table.targetFieldId} IS NULL)
          OR (${table.action} NOT IN ('JUMP_TO_FIELD', 'JUMP_TO_SEGMENT') AND ${table.targetFieldId} IS NULL AND ${table.targetSegmentId} IS NULL)
        )`,
      ),

      // Same again for the else side, where NULL additionally means "no
      // opinion" and must leave both targets empty.
      elseTargetMatchesAction: check(
        "form_logic_rules_else_target_matches_action",
        sql`(
          (${table.elseAction} = 'JUMP_TO_FIELD' AND ${table.elseTargetFieldId} IS NOT NULL AND ${table.elseTargetSegmentId} IS NULL)
          OR (${table.elseAction} = 'JUMP_TO_SEGMENT' AND ${table.elseTargetSegmentId} IS NOT NULL AND ${table.elseTargetFieldId} IS NULL)
          OR (
            (${table.elseAction} IS NULL OR ${table.elseAction} NOT IN ('JUMP_TO_FIELD', 'JUMP_TO_SEGMENT'))
            AND ${table.elseTargetFieldId} IS NULL
            AND ${table.elseTargetSegmentId} IS NULL
          )
        )`,
      ),

      // Neither side may point back at the question that triggered the rule —
      // that's an immediate loop for the respondent. Longer cycles can't be
      // caught by a row-level constraint (the resolver carries a visited-set
      // guard for those), but the one-hop case is free to rule out here.
      noSelfJump: check(
        "form_logic_rules_no_self_jump",
        sql`(${table.targetFieldId} IS NULL OR ${table.targetFieldId} <> ${table.fieldId})
            AND (${table.elseTargetFieldId} IS NULL OR ${table.elseTargetFieldId} <> ${table.fieldId})`,
      ),
    };
  },
);

/**
 * One test inside a branch: "the answer to question F satisfies
 * operator/value".
 *
 * Rows are replaced as a set whenever a rule is saved, so `index` only decides
 * display order and is deliberately not unique — these are never drag-ordered
 * across a shared space, and a unique constraint would add save races for no
 * benefit.
 */
export const formLogicConditionsTable = pgTable(
  "form_logic_conditions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    ruleId: uuid("rule_id")
      .references(() => formLogicRulesTable.id, {
        onDelete: "cascade",
      })
      .notNull(),

    // The question whose answer this condition reads. Not necessarily the
    // rule's trigger question — that's what lets a branch weigh an answer
    // given several questions ago.
    fieldId: uuid("field_id")
      .references(() => formFieldsTable.id, {
        onDelete: "cascade",
      })
      .notNull(),

    operator: logicOperatorEnum("operator").notNull(),

    // Comparison operand. jsonb because answers are already jsonb
    // (`form_submissions.values`) and may be a string, number, boolean, or an
    // array of choices — storing the operand the same way avoids
    // parse-and-guess at comparison time.
    value: jsonb("value"),

    index: numeric("index", { scale: 2 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => {
    return {
      // Loading a rule's conditions in order.
      ruleIdx: index("form_logic_conditions_rule_idx").on(table.ruleId, table.index),
      // Finding the conditions that read a given question, for impact checks
      // when that question is edited or removed.
      fieldIdx: index("form_logic_conditions_field_idx").on(table.fieldId),

      // Operators that compare against an operand need one; the two emptiness
      // checks must not carry a stale value implying the comparison does
      // something it doesn't.
      valueMatchesOperator: check(
        "form_logic_conditions_value_matches_operator",
        sql`(
          (${table.operator} IN ('IS_EMPTY', 'IS_NOT_EMPTY') AND ${table.value} IS NULL)
          OR (${table.operator} NOT IN ('IS_EMPTY', 'IS_NOT_EMPTY') AND ${table.value} IS NOT NULL)
        )`,
      ),
    };
  },
);
