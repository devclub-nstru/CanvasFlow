import { index, jsonb, pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { formsTable } from "./form";
import { formFieldsTable } from "./form-field";

/**
 * Tracks each time a visitor answers a field and clicks Next on the public form.
 * One row per field interaction — used for accurate per-field completion rates
 * and question distribution data (partial fills, not just completed submissions).
 * No auth required; inserted by the public form page.
 */
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
    // The actual answer value the visitor entered before clicking Next
    value: jsonb("value"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    formFieldIdx: index("form_field_views_form_field_idx").on(table.formId, table.fieldId),
    formCreatedIdx: index("form_field_views_created_idx").on(table.formId, table.createdAt),
  }),
);
