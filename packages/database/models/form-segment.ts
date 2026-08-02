import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  integer,
  numeric,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { formsTable } from "./form";

export const formSegmentsTable = pgTable(
  "form_segments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formId: uuid("form_id")
      .references(() => formsTable.id, {
        onDelete: "cascade",
      })
      .notNull(),

    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),

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
      uniqueFormIdAndIndex: unique().on(table.formId, table.index),
      formIdx: index("form_segments_form_idx").on(table.formId),
    };
  },
);
