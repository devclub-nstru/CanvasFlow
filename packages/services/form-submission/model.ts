import { z } from "zod";

export const submitFormValueInput = z.object({
  formFieldId: z.string().uuid(),
  value: z.any(),
});

export const submitFormInput = z.object({
  formId: z.string().uuid().describe("ID of the form to submit"),
  values: z.array(submitFormValueInput).describe("Field values submitted"),
  idempotencyKey: z.string().trim().max(64).optional().nullable(),
  visitorId: z.string().trim().max(64).optional().nullable(),
  referrer: z.string().trim().max(2048).optional().nullable(),
  utmSource: z.string().trim().max(255).optional().nullable(),
  utmMedium: z.string().trim().max(255).optional().nullable(),
  utmCampaign: z.string().trim().max(255).optional().nullable(),
  timeSpentMs: z.number().int().optional().nullable(),
  deviceType: z
    .enum(["desktop", "mobile", "tablet"])
    .optional()
    .nullable()
    .describe("Device type: desktop | mobile | tablet"),
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
  visitorId: z.string().nullable().optional(),
  respondentEmail: z.string().nullable().optional(),
  timeSpentMs: z.number().nullable().optional(),
  deviceType: z.string().nullable().optional(),
  createdAt: z.any(),
});
export type FormSubmissionOutputType = z.infer<typeof formSubmissionOutput>;

export const getSubmissionsInput = z.object({
  formId: z.string().uuid().describe("Form ID"),
  ownerId: z.string().describe("Owner user ID"),
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
  nextCursor: z.string().nullable(),
});
export type GetSubmissionsOutputType = z.infer<typeof getSubmissionsOutput>;
