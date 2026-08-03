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

export const logicMatchEnum = pgEnum("logic_match", ["ALL", "ANY"]);

export const logicActionEnum = pgEnum("logic_action", [
  "JUMP_TO_FIELD",
  "JUMP_TO_SEGMENT",
  "SUBMIT",
  "CONTINUE",
]);

export const formLogicRulesTable = pgTable(
  "form_logic_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    formId: uuid("form_id")
      .references(() => formsTable.id, {
        onDelete: "cascade",
      })
      .notNull(),

    fieldId: uuid("field_id")
      .references(() => formFieldsTable.id, {
        onDelete: "cascade",
      })
      .notNull(),

    match: logicMatchEnum("match").notNull().default("ALL"),

    action: logicActionEnum("action").notNull(),
    targetFieldId: uuid("target_field_id").references(() => formFieldsTable.id, {
      onDelete: "cascade",
    }),
    targetSegmentId: uuid("target_segment_id").references(() => formSegmentsTable.id, {
      onDelete: "cascade",
    }),

    elseAction: logicActionEnum("else_action"),
    elseTargetFieldId: uuid("else_target_field_id").references(() => formFieldsTable.id, {
      onDelete: "cascade",
    }),
    elseTargetSegmentId: uuid("else_target_segment_id").references(() => formSegmentsTable.id, {
      onDelete: "cascade",
    }),

    index: numeric("index", { scale: 2 }).notNull(),
    version: integer("version").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => {
    return {
      formIdx: index("form_logic_rules_form_idx").on(table.formId),
      fieldIdx: index("form_logic_rules_field_idx").on(table.fieldId, table.index),
      targetMatchesAction: check(
        "form_logic_rules_target_matches_action",
        sql`(
          (${table.action} = 'JUMP_TO_FIELD' AND ${table.targetFieldId} IS NOT NULL AND ${table.targetSegmentId} IS NULL)
          OR (${table.action} = 'JUMP_TO_SEGMENT' AND ${table.targetSegmentId} IS NOT NULL AND ${table.targetFieldId} IS NULL)
          OR (${table.action} NOT IN ('JUMP_TO_FIELD', 'JUMP_TO_SEGMENT') AND ${table.targetFieldId} IS NULL AND ${table.targetSegmentId} IS NULL)
        )`,
      ),

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

      noSelfJump: check(
        "form_logic_rules_no_self_jump",
        sql`(${table.targetFieldId} IS NULL OR ${table.targetFieldId} <> ${table.fieldId})
            AND (${table.elseTargetFieldId} IS NULL OR ${table.elseTargetFieldId} <> ${table.fieldId})`,
      ),
    };
  },
);

export const formLogicConditionsTable = pgTable(
  "form_logic_conditions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    ruleId: uuid("rule_id")
      .references(() => formLogicRulesTable.id, {
        onDelete: "cascade",
      })
      .notNull(),

    fieldId: uuid("field_id")
      .references(() => formFieldsTable.id, {
        onDelete: "cascade",
      })
      .notNull(),

    operator: logicOperatorEnum("operator").notNull(),
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
      ruleIdx: index("form_logic_conditions_rule_idx").on(table.ruleId, table.index),
      fieldIdx: index("form_logic_conditions_field_idx").on(table.fieldId),
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
