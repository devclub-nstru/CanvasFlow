import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  text,
  jsonb,
  integer,
  serial,
  numeric,
  pgEnum,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { formsTable } from "./form";
import { formSegmentsTable } from "./form-segment";

export const fieldTypeEnum = pgEnum("field_type_num", [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "EMAIL",
  "PHONE",
  "URL",
  "SELECT",
  "RADIO",
  "CHECKBOX",
  "DATE",
  "RATING",
  "FILE_UPLOAD",
  "TIME",
  "DATETIME",
  "SLIDER",
  "TOGGLE",
]);

export const formFieldsTable = pgTable(
  "form_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formId: uuid("form_id")
      .references(() => formsTable.id, {
        onDelete: "cascade",
      })
      .notNull(),

    // Which segment (page) this question belongs to.
    //
    // Nullable on purpose. NULL means "the implicit first segment", which is
    // exactly how every form behaved before segments existed — so forms
    // created earlier keep working with no backfill and no behaviour change.
    // The moment an editor adds a real segment, the service assigns these
    // loose fields to it (see `ensureDefaultSegment`), and from then on the
    // form is explicitly segmented.
    //
    // ON DELETE SET NULL, not CASCADE: deleting a segment must not silently
    // delete the editor's questions. They fall back to the implicit first
    // segment where they stay visible and recoverable.
    segmentId: uuid("segment_id").references(() => formSegmentsTable.id, {
      onDelete: "set null",
    }),

    label: varchar("label", { length: 255 }).notNull(),
    labelKey: varchar("label_key", { length: 255 }).notNull(),

    placeholder: varchar("placeholder", { length: 255 }),

    isRequired: boolean("is_required").default(false).notNull(),

    index: numeric("index", { scale: 2 }).notNull(),

    type: fieldTypeEnum("type").notNull(),

    options: jsonb("options"),

    description: text("description"),

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
      // Ordering stays scoped to the FORM, not the segment. Effective
      // question order is (segment.index, field.index), so a field's index
      // only ever has to be unique within the form for the sort to be
      // stable — and keeping the constraint here means moving a field
      // between segments is a one-column update that can't collide.
      uniqueFormIdAndIndex: unique().on(table.formId, table.index),
      // Hot path for listing a form's fields ordered by index
      formIdx: index("form_fields_form_idx").on(table.formId),
      // Grouping a form's fields by segment when rendering / reordering.
      segmentIdx: index("form_fields_segment_idx").on(table.segmentId, table.index),
    };
  },
);
