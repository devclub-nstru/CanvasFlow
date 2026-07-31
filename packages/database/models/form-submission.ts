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
import { usersTable } from "./auth";

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
    // persisted in localStorage as `cf_vid_<formId>`).
    //
    // No longer a uniqueness key. It used to carry a hard one-per-browser
    // lockout, which was both too strict (a shared computer locked out the
    // second person) and too weak (a different browser defeated it). Limiting
    // responses is now an opt-in tied to an account. This is kept because the
    // returning-respondent metric is derived from it.
    visitorId: varchar("visitor_id", { length: 64 }),

    // The signed-in respondent, when the form required signing in. Nullable
    // because a form that doesn't require it still accepts anonymous answers.
    //
    // ON DELETE SET NULL, not CASCADE: if the respondent later deletes their
    // account, the response is still the form owner's data and still counts —
    // it just becomes anonymous again.
    respondentUserId: text("respondent_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),

    // Copied from the account at submit time when the form asks for it. Stored
    // rather than joined so the response keeps the address it was submitted
    // with, even if the respondent later changes their account email or
    // deletes the account.
    respondentEmail: varchar("respondent_email", { length: 255 }),

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
    // Non-unique on purpose.
    //
    // "One response per respondent" is a per-form setting, and a unique index
    // can't be conditional on a column in another table — so the rule is
    // enforced in the service, and this index is what makes that check cheap.
    // The residual race (the same account submitting twice simultaneously) is
    // narrow and its outcome is a duplicate row rather than corruption; the
    // idempotency key already covers the common cause, double-clicks.
    formRespondentIdx: index("form_submissions_form_respondent_idx").on(
      table.formId,
      table.respondentUserId,
    ),
  }),
);
