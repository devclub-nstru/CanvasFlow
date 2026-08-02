import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { formsTable } from "./form";
import { formFieldsTable } from "./form-field";
import { formSubmissionsTable } from "./form-submission";

export const uploadStatusEnum = pgEnum("upload_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);

export const formUploadsTable = pgTable(
  "form_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    formId: uuid("form_id")
      .references(() => formsTable.id, { onDelete: "cascade" })
      .notNull(),
    formFieldId: uuid("form_field_id")
      .references(() => formFieldsTable.id, { onDelete: "cascade" })
      .notNull(),

    submissionId: uuid("submission_id").references(() => formSubmissionsTable.id, {
      onDelete: "cascade",
    }),

    claimToken: varchar("claim_token", { length: 64 }).notNull(),

    status: uploadStatusEnum("status").notNull().default("pending"),

    originalName: varchar("original_name", { length: 255 }).notNull(),

    mimeType: varchar("mime_type", { length: 127 }).notNull(),

    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    storedPath: text("stored_path"),

    cloudinaryPublicId: varchar("cloudinary_public_id", { length: 512 }),
    cloudinaryUrl: text("cloudinary_url"),
    cloudinaryResourceType: varchar("cloudinary_resource_type", { length: 32 }),

    error: text("error"),

    attempts: integer("attempts").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    formFieldIdx: index("form_uploads_form_field_idx").on(table.formId, table.formFieldId),
    submissionIdx: index("form_uploads_submission_idx").on(table.submissionId),
    statusCreatedIdx: index("form_uploads_status_created_idx").on(table.status, table.createdAt),
  }),
);

export type FormUploadRow = typeof formUploadsTable.$inferSelect;

export interface SubmittedFileValue {
  uploadId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
  status: "pending" | "processing" | "ready" | "failed";
}
