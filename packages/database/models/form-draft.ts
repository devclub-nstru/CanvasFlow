import { pgTable, uuid, text, jsonb, timestamp, unique, index } from "drizzle-orm/pg-core";
import { formsTable } from "./form";
import { usersTable } from "./auth";

export const formDraftsTable = pgTable(
  "form_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    formId: uuid("form_id")
      .references(() => formsTable.id, { onDelete: "cascade" })
      .notNull(),

    userId: text("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),

    values: jsonb("values").notNull(),
    pagePath: jsonb("page_path"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => {
    return {
      uniqueFormAndUser: unique().on(table.formId, table.userId),
      userFormIdx: index("form_drafts_user_form_idx").on(table.userId, table.formId),
    };
  },
);
