import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { formsTable } from "./form";
import { usersTable } from "./auth";

export const collaboratorRoleEnum = pgEnum("collaborator_role", ["viewer", "editor"]);

export const formCollaboratorsTable = pgTable(
  "form_collaborators",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formId: uuid("form_id")
      .references(() => formsTable.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    role: collaboratorRoleEnum("role").notNull(),
    addedBy: text("added_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    formIdx: index("form_collaborators_form_idx").on(table.formId),
    userIdx: index("form_collaborators_user_idx").on(table.userId),
    formUserUniqIdx: uniqueIndex("form_collaborators_form_user_uniq_idx").on(
      table.formId,
      table.userId,
    ),
  }),
);
