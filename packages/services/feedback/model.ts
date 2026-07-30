import { z } from "zod";

export const feedbackTypeSchema = z.enum(["bug", "feedback", "complaint", "feature_request"]);
export type FeedbackType = z.infer<typeof feedbackTypeSchema>;

/**
 * What a reporter is allowed to send.
 *
 * Note what is absent: `userId`, `email`, `status` and `priority`. The widget
 * used to post all four. The first two are identity and must come from the
 * session or not at all; the last two are triage fields that belong to whoever
 * works the queue. Accepting any of them from the client would let a caller
 * file a report as somebody else, or mark their own ticket high priority.
 */
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
  /**
   * Page the report was filed from. Capped and format-checked because it is
   * attacker-controlled and ends up rendered in a triage view.
   */
  pageUrl: z.string().trim().max(2048).optional().nullable(),
});
export type SubmitFeedbackInputType = z.infer<typeof submitFeedbackInput>;

export const submitFeedbackOutput = z.object({
  id: z.string().uuid(),
});
export type SubmitFeedbackOutputType = z.infer<typeof submitFeedbackOutput>;
