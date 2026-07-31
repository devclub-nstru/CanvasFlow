import { z } from "zod";

// ─── Inputs ──────────────────────────────────────────────────────────────────

export const getFormAnalyticsInput = z.object({
  formId: z.string().uuid().describe("Form ID"),
});
export type GetFormAnalyticsInputType = z.infer<typeof getFormAnalyticsInput>;

export const getSubmissionsListInput = z.object({
  formId: z.string().uuid().describe("Form ID"),
  // Cursor-based pagination — see form-submission/model for the rationale.
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
export type GetSubmissionsListInputType = z.infer<typeof getSubmissionsListInput>;

// ─── Shared sub-shapes ────────────────────────────────────────────────────────

export const submissionValueOutput = z.object({
  formFieldId: z.string().uuid(),
  value: z.any(),
});

export const submissionOutput = z.object({
  id: z.string().uuid(),
  formId: z.string().uuid(),
  values: z.array(submissionValueOutput),
  createdAt: z.any(),
});

// ─── Analytics output ─────────────────────────────────────────────────────────

export const getFormAnalyticsOutput = z.object({
  // Core counts
  totalResponses: z.number(),

  // Device split of submissions (form_submissions.device_type). Rows with no
  // recorded device are excluded, so these counts can total less than
  // totalResponses.
  deviceBreakdown: z.array(
    z.object({
      device: z.string(),
      count: z.number(),
    }),
  ),

  // 30-day daily trend (zero-filled)
  dailyTrends: z.array(
    z.object({
      date: z.string(), // "Jun 1"
      count: z.number(),
    }),
  ),

  // Derived stats
  peakDay: z.string().nullable(), // day of week with most submissions
  avgSubmissionsPerDay: z.number(),
  avgSubmissionsPerWeek: z.number(),
});
export type GetFormAnalyticsOutputType = z.infer<typeof getFormAnalyticsOutput>;

// ─── Submissions list output ──────────────────────────────────────────────────

export const getSubmissionsListOutput = z.object({
  submissions: z.array(submissionOutput),
  // null when there are no more pages
  nextCursor: z.string().nullable(),
});
export type GetSubmissionsListOutputType = z.infer<typeof getSubmissionsListOutput>;

// ─── Record field answer ──────────────────────────────────────────────────────

export const recordFieldAnswerInput = z.object({
  formId: z.string().uuid(),
  fieldId: z.string().uuid(),
  value: z.any(), // the answer the visitor entered
});
export type RecordFieldAnswerInputType = z.infer<typeof recordFieldAnswerInput>;

export const recordFieldAnswerOutput = z.object({
  success: z.boolean(),
});
export type RecordFieldAnswerOutputType = z.infer<typeof recordFieldAnswerOutput>;

// ─── Pro analytics ────────────────────────────────────────────────────────────

export const getProAnalyticsInput = z.object({
  formId: z.string().uuid().describe("Form ID"),
});
export type GetProAnalyticsInputType = z.infer<typeof getProAnalyticsInput>;

export const questionDistributionOutput = z.object({
  fieldId: z.string().uuid(),
  fieldLabel: z.string(),
  fieldType: z.string(),
  totalAnswered: z.number(),
  // For SELECT/CHECKBOX/RADIO: answer → count
  optionCounts: z
    .array(
      z.object({
        value: z.string(),
        count: z.number(),
        percent: z.number(),
      }),
    )
    .optional(),
  // For RATING: average score
  averageRating: z.number().optional(),
  // For RATING: distribution per star value (1–5)
  ratingDistribution: z
    .array(
      z.object({
        rating: z.number(),
        count: z.number(),
        percent: z.number(),
      }),
    )
    .optional(),
  // For TOGGLE: true/false counts
  toggleCounts: z.object({ yes: z.number(), no: z.number() }).optional(),
  // For TEXT/TEXTAREA/EMAIL/NUMBER/PHONE/URL/DATE/TIME: up to 5 recent samples
  textSamples: z.array(z.string()).optional(),
});

export const getProAnalyticsOutput = z.object({
  dowBreakdown: z.array(z.object({ day: z.string(), count: z.number() })),
  trend30d: z.number(),
  trend60d: z.number(),
  trend90d: z.number(),
  velocityFirst24h: z.number(),
  questionDistribution: z.array(questionDistributionOutput),
  medianResponseTime: z.number().nullable(),
  returningRate: z.number(),
  peakDay: z.string().nullable(),
  fieldCompletionRates: z.array(
    z.object({
      fieldId: z.string(),
      fieldLabel: z.string(),
      rate: z.number(),
    }),
  ),
  // Avg time to complete (ms), from timeSpentMs column
  avgTimeSpentMs: z.number().nullable(),
  // Top referrers (domain → count), from form_submissions.referrer — so this
  // is attribution for people who submitted, not everyone who arrived.
  topReferrers: z.array(z.object({ referrer: z.string(), count: z.number() })),
  // UTM source breakdown, also from form_submissions
  utmSources: z.array(z.object({ source: z.string(), count: z.number() })),
});
export type GetProAnalyticsOutputType = z.infer<typeof getProAnalyticsOutput>;
