import { z } from "zod";

export const feedbackTypeSchema = z.enum(["bug", "feedback", "complaint", "feature_request"]);
export type FeedbackType = z.infer<typeof feedbackTypeSchema>;

export const submitFeedbackInput = z.object({
  type: feedbackTypeSchema.default("feedback"),
  subject: z
    .string()
    .trim()
    .min(3, "Subject is too short")
    .max(120, "Subject must be 120 characters or fewer"),
  message: z
    .string()
    .trim()
    .min(10, "Please add a little more detail")
    .max(1000, "Details must be 1000 characters or fewer"),
  pageUrl: z.string().trim().max(2048).optional().nullable(),
});
export type SubmitFeedbackInputType = z.infer<typeof submitFeedbackInput>;

export const submitFeedbackOutput = z.object({
  id: z.string().uuid(),
});
export type SubmitFeedbackOutputType = z.infer<typeof submitFeedbackOutput>;

export const feedbackStatusSchema = z.enum([
  "open",
  "triaged",
  "in_progress",
  "resolved",
  "closed",
]);
export type FeedbackStatusType = z.infer<typeof feedbackStatusSchema>;

export const listFeedbackInput = z.object({
  status: feedbackStatusSchema.optional().describe("Only reports in this status"),
  type: feedbackTypeSchema.optional().describe("Only reports of this kind"),
  assignedToMe: z.boolean().optional().describe("Only reports assigned to the caller"),
  unassigned: z.boolean().optional().describe("Only reports nobody owns yet"),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListFeedbackInputType = z.infer<typeof listFeedbackInput>;

const feedbackRowOutput = z.object({
  id: z.string().uuid(),
  type: feedbackTypeSchema,
  subject: z.string(),
  message: z.string(),
  status: feedbackStatusSchema,

  reporterId: z.string().nullable(),
  reporterName: z.string().nullable(),
  reporterEmail: z.string().nullable(),

  assignedTo: z.string().nullable(),
  assigneeName: z.string().nullable(),
  assigneeEmail: z.string().nullable(),

  pageUrl: z.string().nullable(),
  userAgent: z.string().nullable(),

  createdAt: z.any(),
  updatedAt: z.any(),
});

export const listFeedbackOutput = z.object({
  items: z.array(feedbackRowOutput),
  total: z.number().describe("Matching rows ignoring limit/offset"),
});
export type ListFeedbackOutputType = z.infer<typeof listFeedbackOutput>;

export const getFeedbackInput = z.object({
  id: z.string().uuid().describe("Feedback ID"),
});
export type GetFeedbackInputType = z.infer<typeof getFeedbackInput>;

export const getFeedbackOutput = feedbackRowOutput;
export type GetFeedbackOutputType = z.infer<typeof getFeedbackOutput>;

/* `claim` rather than `assignedTo`: a report can only be taken by the person
 * taking it, or handed back to the pool. There is deliberately no way to name
 * an assignee — the caller's own id is filled in server-side — so nobody can
 * put work on someone else's plate, and a forged request cannot either.
 *
 *   claim: true   → assign to whoever is calling
 *   claim: false  → hand back, unassigned
 *
 * Deliberately no `.refine()` guarding against an empty patch: the OpenAPI
 * generator calls `.omit()` on every input schema and zod refuses that on a
 * schema carrying refinements, which takes the whole API down at boot. The
 * empty-patch check lives in the service instead. */
export const updateFeedbackInput = z.object({
  id: z.string().uuid(),
  status: feedbackStatusSchema.optional(),
  claim: z.boolean().optional(),
});
export type UpdateFeedbackInputType = z.infer<typeof updateFeedbackInput>;

export const updateFeedbackOutput = feedbackRowOutput;
export type UpdateFeedbackOutputType = z.infer<typeof updateFeedbackOutput>;

export const feedbackStatsOutput = z.object({
  open: z.number(),
  triaged: z.number(),
  inProgress: z.number(),
  resolved: z.number(),
  closed: z.number(),
  assignedToMe: z.number(),
  total: z.number(),
});
export type FeedbackStatsOutputType = z.infer<typeof feedbackStatsOutput>;
