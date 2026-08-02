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

    idempotencyKey: varchar("idempotency_key", { length: 64 }),

    visitorId: varchar("visitor_id", { length: 64 }),

    respondentUserId: text("respondent_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),

    respondentEmail: varchar("respondent_email", { length: 255 }),

    referrer: varchar("referrer", { length: 2048 }),
    utmSource: varchar("utm_source", { length: 255 }),
    utmMedium: varchar("utm_medium", { length: 255 }),
    utmCampaign: varchar("utm_campaign", { length: 255 }),
    timeSpentMs: integer("time_spent_ms"),

    deviceType: varchar("device_type", { length: 50 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    formCreatedIdx: index("form_submissions_form_created_idx").on(table.formId, table.createdAt),
    formIdempotencyIdx: uniqueIndex("form_submissions_form_idempotency_idx")
      .on(table.formId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    formRespondentIdx: index("form_submissions_form_respondent_idx").on(
      table.formId,
      table.respondentUserId,
    ),
  }),
);
