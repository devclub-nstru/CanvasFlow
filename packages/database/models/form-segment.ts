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

/**
 * A segment is an ordered group of questions inside a form — "page 1",
 * "page 2", etc. Respondents move through a form segment by segment, and
 * branching rules (see `form-logic.ts`) can route them to a segment other
 * than the next one in order.
 *
 * Why a table rather than a column on `form_fields`: a segment carries its
 * own title/description that render above its questions, it has to exist
 * before any field is assigned to it, and branch rules need a stable
 * target id to point at. A plain `segment_number` integer on the field
 * couldn't express any of that, and renumbering on reorder would fight the
 * fractional-index scheme fields already use.
 *
 * Ordering mirrors `form_fields.index` exactly: a fractional `numeric` with
 * UNIQUE(form_id, index), so inserting a segment between two others is a
 * single-row write. See `apps/web/lib/fractional-index.ts`.
 */
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
      uniqueFormIdAndIndex: unique().on(table.formId, table.index),
      // Hot path for listing a form's segments ordered by index
      formIdx: index("form_segments_form_idx").on(table.formId),
    };
  },
);
