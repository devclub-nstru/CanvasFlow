import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { formsTable } from "./form";

export interface FormSubmissionValue {
  formFieldId: string;
  value: any;
}

export type FormSubmissionValueRow = FormSubmissionValue[];

export const formSubmissionsTable = pgTable(
  "form_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    formId: uuid("form_id")
      .references(() => formsTable.id, { onDelete: "cascade" })
      .notNull(),

    values: jsonb("values").$type<FormSubmissionValueRow>().notNull(),

    // Idempotency key supplied by the client (UUID generated when the
    // submit form mounts). When present, the server rejects duplicate
    // submissions with the same (form_id, idempotency_key). Stops
    // accidental double-submits from rapid double-clicks or retried
    // network requests.
    idempotencyKey: varchar("idempotency_key", { length: 64 }),

    // Per-form anonymous visitor id (UUID, generated client-side and
    // persisted in localStorage as `cf_vid_<formId>`). When supplied,
    // (form_id, visitor_id) is unique so a returning visitor can't
    // submit the same form twice. We keep this nullable for
    // private-mode / no-storage clients — those just fall through to
    // the idempotency-key check.
    visitorId: varchar("visitor_id", { length: 64 }),

    // Attribution & timing (collected by the public form page)
    referrer: varchar("referrer", { length: 2048 }),
    utmSource: varchar("utm_source", { length: 255 }),
    utmMedium: varchar("utm_medium", { length: 255 }),
    utmCampaign: varchar("utm_campaign", { length: 255 }),
    timeSpentMs: integer("time_spent_ms"), // ms from page load to submit

    // Device the submission came from ("desktop" | "mobile" | "tablet"),
    // sniffed from the user agent by the public form page. Nullable: rows
    // written before this column existed carry no device information, and
    // the analytics device breakdown skips them rather than guessing.
    deviceType: varchar("device_type", { length: 50 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    formCreatedIdx: index("form_submissions_form_created_idx").on(table.formId, table.createdAt),
    // Partial unique index on (form_id, idempotency_key) so the constraint
    // only applies when an idempotency key is actually supplied.
    formIdempotencyIdx: uniqueIndex("form_submissions_form_idempotency_idx")
      .on(table.formId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    // Partial unique index on (form_id, visitor_id). Enforces the
    // "one submission per visitor" rule at the database level so two
    // racing inserts can't both squeak through the application-level
    // check. NULL visitor_ids (no localStorage available) are exempt.
    formVisitorIdx: uniqueIndex("form_submissions_form_visitor_idx")
      .on(table.formId, table.visitorId)
      .where(sql`${table.visitorId} IS NOT NULL`),
  }),
);
