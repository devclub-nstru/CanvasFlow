import { z } from "zod";

export const submitFormValueInput = z.object({
  formFieldId: z.string().uuid(),
  value: z.any(),
});

export const submitFormInput = z.object({
  formId: z.string().uuid().describe("ID of the form to submit"),
  values: z.array(submitFormValueInput).describe("Field values submitted"),
  // Idempotency: client-generated UUID per submit attempt. The server
  // deduplicates on (form_id, idempotency_key) so a double-click or a
  // retried network request can't create two submissions.
  idempotencyKey: z.string().trim().max(64).optional().nullable(),
  // Per-form visitor id (UUID stored in localStorage as `cf_vid_<formId>`).
  // When supplied, the server enforces one submission per visitor — a
  // returning visitor on the same browser is rejected with
  // ALREADY_SUBMITTED.
  visitorId: z.string().trim().max(64).optional().nullable(),
  // Optional attribution — collected by the public form page
  referrer: z.string().trim().max(2048).optional().nullable(),
  utmSource: z.string().trim().max(255).optional().nullable(),
  utmMedium: z.string().trim().max(255).optional().nullable(),
  utmCampaign: z.string().trim().max(255).optional().nullable(),
  timeSpentMs: z.number().int().optional().nullable(),
});
export type SubmitFormInputType = z.infer<typeof submitFormInput>;

export const submitFormOutput = z.object({
  id: z.string().uuid().describe("ID of the created submission"),
});
export type SubmitFormOutputType = z.infer<typeof submitFormOutput>;

export const formSubmissionValueOutput = z.object({
  formFieldId: z.string().uuid(),
  value: z.any(),
});

export const formSubmissionOutput = z.object({
  id: z.string().uuid(),
  formId: z.string().uuid(),
  values: z.array(formSubmissionValueOutput),
  createdAt: z.any(),
});
export type FormSubmissionOutputType = z.infer<typeof formSubmissionOutput>;

export const getSubmissionsInput = z.object({
  formId: z.string().uuid().describe("Form ID"),
  ownerId: z.string().describe("Owner user ID"),
  // Cursor-based pagination — the `createdAt` ISO timestamp of the last
  // row from the previous page. The server returns the next page of rows
  // older than that timestamp. Cursor pagination is stable under inserts
  // (unlike offset, which shifts as new rows arrive).
  cursor: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .describe("ISO timestamp of the last submission from the previous page"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe("Max submissions to return (default 50, max 200)"),
});
export type GetSubmissionsInputType = z.infer<typeof getSubmissionsInput>;

export const getSubmissionsOutput = z.object({
  submissions: z.array(formSubmissionOutput),
  // Cursor for the next page (ISO timestamp of the last row, or null if
  // this was the final page).
  nextCursor: z.string().nullable(),
  viewsCount: z.number(),
  deviceViews: z.array(
    z.object({
      device: z.string(),
      count: z.number(),
    }),
  ),
});
export type GetSubmissionsOutputType = z.infer<typeof getSubmissionsOutput>;

export const recordViewInput = z.object({
  formId: z.string().uuid().describe("Form ID"),
  deviceType: z.string().describe("Device type (mobile, tablet, desktop)"),
});
export type RecordViewInputType = z.infer<typeof recordViewInput>;

export const recordViewOutput = z.object({
  success: z.boolean(),
});
export type RecordViewOutputType = z.infer<typeof recordViewOutput>;
