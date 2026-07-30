import { and, count, db, eq, gte } from "@repo/database";
import { feedbackTable } from "@repo/database/models/feedback";

import {
  submitFeedbackInput,
  type SubmitFeedbackInputType,
  type SubmitFeedbackOutputType,
} from "./model";

/**
 * Per-reporter flood ceiling.
 *
 * The endpoint is deliberately public — someone hitting a bug on the marketing
 * site should be able to tell us without signing up first. That also makes it
 * the easiest write in the app to abuse, so there are two independent guards:
 * the IP rate limiter in `apps/api/src/server.ts`, and this per-identity count.
 * The limiter alone isn't enough (one attacker, many IPs); this alone isn't
 * either (anonymous reports have no identity to count). Together they cover
 * both shapes.
 *
 * Only applies to identified reporters, since anonymous rows have no stable
 * key to group on — those lean on the IP limiter.
 */
const MAX_PER_IDENTITY_PER_HOUR = 10;

/** Bugs jump the queue; everything else lands at the default. */
const priorityForType = (type: SubmitFeedbackInputType["type"]) =>
  type === "bug" || type === "complaint" ? ("high" as const) : ("medium" as const);

class FeedbackService {
  /**
   * Files a report.
   *
   * `identity` is resolved by the caller from the session — never from the
   * request body. Pass `{}` for an anonymous reporter.
   */
  public async submitFeedback(
    payload: SubmitFeedbackInputType & {
      identity?: { userId?: string | null; email?: string | null };
      userAgent?: string | null;
    },
  ): Promise<SubmitFeedbackOutputType> {
    const input = await submitFeedbackInput.parseAsync(payload);

    const userId = payload.identity?.userId ?? null;
    const email = payload.identity?.email ?? null;

    if (userId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [recent] = await db
        .select({ value: count() })
        .from(feedbackTable)
        .where(and(eq(feedbackTable.userId, userId), gte(feedbackTable.createdAt, oneHourAgo)));

      if ((recent?.value ?? 0) >= MAX_PER_IDENTITY_PER_HOUR) {
        // Deliberately vague about the exact ceiling.
        throw new Error("You've sent a lot of reports recently. Please try again later.");
      }
    }

    const [row] = await db
      .insert(feedbackTable)
      .values({
        type: input.type,
        subject: input.subject,
        message: input.message,
        // status is left to the column default ("open") on purpose.
        priority: priorityForType(input.type),
        userId,
        email,
        pageUrl: input.pageUrl ?? null,
        // Truncated rather than rejected — an odd UA string shouldn't cost
        // someone their bug report.
        userAgent: payload.userAgent ? payload.userAgent.slice(0, 512) : null,
      })
      .returning({ id: feedbackTable.id });

    if (!row) throw new Error("Failed to save feedback");

    return { id: row.id };
  }
}

export default FeedbackService;
