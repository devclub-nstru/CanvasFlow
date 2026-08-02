import { z } from "zod";

export const feedbackTypeSchema = z.enum(["bug", "feedback", "complaint", "feature_request"]);
export type FeedbackType = z.infer<typeof feedbackTypeSchema>;

// Input schema for submitting feedback
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
