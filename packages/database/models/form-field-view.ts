import { index, jsonb, pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { formsTable } from "./form";
import { formFieldsTable } from "./form-field";

export const formFieldViewsTable = pgTable(
  "form_field_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .references(() => formsTable.id, { onDelete: "cascade" })
      .notNull(),
    fieldId: uuid("field_id")
      .references(() => formFieldsTable.id, { onDelete: "cascade" })
      .notNull(),
    value: jsonb("value"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    formFieldIdx: index("form_field_views_form_field_idx").on(table.formId, table.fieldId),
    formCreatedIdx: index("form_field_views_created_idx").on(table.formId, table.createdAt),
  }),
);
