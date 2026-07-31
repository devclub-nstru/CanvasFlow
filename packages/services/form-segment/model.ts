import { z } from "zod";

// Same sanitisation policy as the rest of the services: `.trim()` on every
// string so whitespace-only differences can't create near-duplicate titles,
// and length caps that match the varchar/text columns.

export const createFormSegmentInput = z.object({
  formId: z.string().uuid().describe("ID of the parent form"),
  title: z.string().trim().min(1).max(255).describe("Title shown above the segment's questions"),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .describe("Help text shown under the segment title"),
  index: z
    .union([z.number(), z.string()])
    .transform((val) => String(val))
    .optional()
    .describe("Fractional index for sorting"),
  // On a form that has no segments yet, the default behaviour is to also
  // create a "Segment 1" and move every unassigned question into it — so a
  // single call turns a flat form into a segmented one, which is what a
  // direct API caller wants.
  //
  // The builder passes `false`. It keeps segments and question assignments in
  // one local draft and saves them together, so it creates "Segment 1"
  // itself; letting the server also create one would produce a duplicate.
  adoptUnassignedFields: z
    .boolean()
    .default(true)
    .describe("Also create a first segment and move unassigned questions into it"),
});
export type CreateFormSegmentInputType = z.infer<typeof createFormSegmentInput>;

export const updateFormSegmentInput = z.object({
  id: z.string().uuid().describe("ID of the segment to update"),
  title: z.string().trim().min(1).max(255).optional().describe("Title of the segment"),
  description: z.string().trim().max(2000).optional().nullable().describe("Description"),
  index: z
    .union([z.number(), z.string()])
    .transform((val) => String(val))
    .optional()
    .describe("Fractional index for sorting"),
  expectedVersion: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Optimistic-lock token returned by the previous read of this segment"),
});
export type UpdateFormSegmentInputType = z.infer<typeof updateFormSegmentInput>;

export const deleteFormSegmentInput = z.object({
  id: z.string().uuid().describe("ID of the segment to delete"),
});
export type DeleteFormSegmentInputType = z.infer<typeof deleteFormSegmentInput>;

export const listFormSegmentsInput = z.object({
  formId: z.string().uuid().describe("ID of the parent form"),
});
export type ListFormSegmentsInputType = z.infer<typeof listFormSegmentsInput>;

export const getFormSegmentOutput = z.object({
  id: z.string().uuid().describe("ID of the segment"),
  formId: z.string().uuid().describe("ID of the parent form"),
  title: z.string().describe("Title of the segment"),
  description: z.string().nullable().optional().describe("Description of the segment"),
  index: z.string().describe("Fractional index for sorting"),
  version: z.number().int().describe("Optimistic-lock version"),
  createdAt: z.any().describe("Creation timestamp"),
  updatedAt: z.any().describe("Last update timestamp"),
});
export type GetFormSegmentOutputType = z.infer<typeof getFormSegmentOutput>;

export const listFormSegmentsOutput = z.array(getFormSegmentOutput);
export type ListFormSegmentsOutputType = z.infer<typeof listFormSegmentsOutput>;

export const createFormSegmentOutput = z.object({
  id: z.string().uuid().describe("ID of the created segment"),
  index: z.string().describe("Fractional index the segment was created at"),
  // When the form had no segments yet, creating one also materialises a
  // "Segment 1" for the pre-existing questions. The caller needs to know
  // that happened so it can show both segments without a refetch.
  createdDefaultSegment: getFormSegmentOutput
    .nullable()
    .describe("The implicit first segment, if this call had to materialise it"),
});
export type CreateFormSegmentOutputType = z.infer<typeof createFormSegmentOutput>;

export const updateFormSegmentOutput = z.object({
  id: z.string().uuid().describe("ID of the updated segment"),
  version: z.number().int().describe("New optimistic-lock version after the update"),
});
export type UpdateFormSegmentOutputType = z.infer<typeof updateFormSegmentOutput>;

export const deleteFormSegmentOutput = z.object({
  success: z.boolean().describe("Whether deletion was successful"),
  // Fields are not deleted with their segment — they fall back to the
  // implicit first segment. Report how many moved so the UI can say so.
  releasedFieldCount: z.number().int().describe("Questions that fell back to the first segment"),
});
export type DeleteFormSegmentOutputType = z.infer<typeof deleteFormSegmentOutput>;
