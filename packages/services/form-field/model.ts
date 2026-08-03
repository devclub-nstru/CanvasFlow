import { z } from "zod";

export const fieldTypeZodEnum = z.enum([
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

export const createFormFieldInput = z.object({
  formId: z.string().uuid().describe("ID of the parent form"),
  segmentId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .describe("Segment this question belongs to; null means the implicit first segment"),
  label: z.string().trim().max(255, "Label is too long"),
  placeholder: z.string().trim().max(255).optional().nullable(),
  isRequired: z.boolean().default(false),
  index: z
    .union([z.number(), z.string()])
    .transform((val) => String(val))
    .optional()
    .describe("Fractional index for sorting"),
  type: fieldTypeZodEnum.describe("Type of the field"),
  options: z.any().optional().nullable().describe("Options for select/radio/checkbox in JSON"),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .describe("Help text or description"),
});

export const updateFormFieldInput = z.object({
  id: z.string().uuid().describe("ID of the field to update"),
  segmentId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .describe("Move the question to this segment; null moves it to the implicit first segment"),
  label: z.string().trim().max(255).optional(),
  placeholder: z.string().trim().max(255).optional().nullable(),
  isRequired: z.boolean().optional(),
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
    .describe("Optimistic-lock token returned by the previous read of this field"),
  type: fieldTypeZodEnum.optional().describe("Type of the field"),
  options: z.any().optional().nullable().describe("Options for select/radio/checkbox in JSON"),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .describe("Help text or description"),
});

export const deleteFormFieldInput = z.object({
  id: z.string().uuid().describe("ID of the field to delete"),
});

export type CreateFormFieldInputType = z.infer<typeof createFormFieldInput>;
export type UpdateFormFieldInputType = z.infer<typeof updateFormFieldInput>;
export type DeleteFormFieldInputType = z.infer<typeof deleteFormFieldInput>;

export const createFormFieldOutput = z.object({
  id: z.string().uuid().describe("ID of the created form field"),
});

export const updateFormFieldOutput = z.object({
  id: z.string().uuid().describe("ID of the updated form field"),
  version: z.number().int().describe("New optimistic-lock version after the update"),
});

export const deleteFormFieldOutput = z.object({
  success: z.boolean().describe("Whether deletion was successful"),
});

export type CreateFormFieldOutputType = z.infer<typeof createFormFieldOutput>;
export type UpdateFormFieldOutputType = z.infer<typeof updateFormFieldOutput>;
export type DeleteFormFieldOutputType = z.infer<typeof deleteFormFieldOutput>;

export const getFormFieldInput = z.object({
  id: z.string().uuid().describe("ID of the field to retrieve"),
});

export const getFormFieldOutput = z.object({
  id: z.string().uuid().describe("ID of the form field"),
  formId: z.string().uuid().describe("ID of the parent form"),
  segmentId: z
    .string()
    .uuid()
    .nullable()
    .describe("Segment this question belongs to; null means the implicit first segment"),
  label: z.string().describe("Label of the field"),
  labelKey: z.string().describe("Immutable slug key of the field"),
  placeholder: z.string().nullable().optional().describe("Placeholder of the field"),
  isRequired: z.boolean().describe("Whether field is required"),
  index: z.string().describe("Fractional index for sorting"),
  type: fieldTypeZodEnum.describe("Type of the field"),
  options: z.any().nullable().optional().describe("Options in JSON format"),
  description: z.string().nullable().optional().describe("Description or help text"),
  version: z.number().int().describe("Optimistic-lock version"),
  createdAt: z.any().describe("Creation timestamp"),
  updatedAt: z.any().describe("Last update timestamp"),
});

export type GetFormFieldInputType = z.infer<typeof getFormFieldInput>;
export type GetFormFieldOutputType = z.infer<typeof getFormFieldOutput>;

export const listFormFieldsInput = z.object({
  formId: z.string().uuid().describe("ID of the parent form"),
});
export type ListFormFieldsInputType = z.infer<typeof listFormFieldsInput>;

export const listFormFieldsOutput = z.array(getFormFieldOutput);
export type ListFormFieldsOutputType = z.infer<typeof listFormFieldsOutput>;
