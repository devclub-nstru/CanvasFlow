import { z } from "zod";

export const saveDraftInput = z.object({
  formId: z.string().uuid().describe("Form being filled in"),
  values: z.record(z.string(), z.any()).describe("Answers so far, keyed by field id"),
  pagePath: z
    .array(z.number().int().nonnegative())
    .optional()
    .describe("Pages visited so far, so the respondent resumes where they stopped"),
});
export type SaveDraftInputType = z.infer<typeof saveDraftInput>;

export const saveDraftOutput = z.object({
  id: z.string().uuid(),
  updatedAt: z.string().describe("ISO-8601 timestamp of this save"),
});
export type SaveDraftOutputType = z.infer<typeof saveDraftOutput>;

export const getDraftInput = z.object({
  formId: z.string().uuid().describe("Form being filled in"),
});
export type GetDraftInputType = z.infer<typeof getDraftInput>;

export const getDraftOutput = z
  .object({
    values: z.record(z.string(), z.any()),
    pagePath: z.array(z.number().int()).nullable(),
    updatedAt: z.string().describe("ISO-8601 timestamp of the last save"),
  })
  .nullable();
export type GetDraftOutputType = z.infer<typeof getDraftOutput>;

export const deleteDraftInput = z.object({
  formId: z.string().uuid().describe("Form whose draft should be discarded"),
});
export type DeleteDraftInputType = z.infer<typeof deleteDraftInput>;

export const deleteDraftOutput = z.object({
  success: z.boolean(),
});
export type DeleteDraftOutputType = z.infer<typeof deleteDraftOutput>;
