import { TRPCError } from "@trpc/server";

import { publicProcedure, router } from "../../trpc";
import { auth } from "../../auth";
import { feedbackService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import { submitFeedbackInput, submitFeedbackOutput } from "@repo/services/feedback/model";

const TAGS = ["Feedback"];
const getPath = generatePath("/feedback");

export const feedbackRouter = router({
  /**
   * POST /feedback/submit
   *
   * Files a report from the in-app widget. Public on purpose: the widget is
   * reachable from the marketing pages, and requiring an account to report a
   * bug on the signup flow would be circular.
   *
   * Identity is resolved here from the session cookie rather than taken from
   * the input. `publicProcedure` doesn't populate `ctx.user`, so the session is
   * read directly — the same call `authenticatedProcedure` makes, minus the
   * throw when it's absent. A signed-in reporter gets attributed; everyone else
   * files anonymously. This is the whole reason the input schema has no
   * `userId`/`email`: otherwise anyone could file a report as anyone.
   *
   * Abuse is handled in two places, since neither is sufficient alone:
   *   · `publicWriteLimiter` in apps/api/src/server.ts — per IP
   *   · MAX_PER_IDENTITY_PER_HOUR in the service — per account
   */
  submitFeedback: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/submit"),
        tags: TAGS,
        protect: false,
      },
    })
    .input(submitFeedbackInput)
    .output(submitFeedbackOutput)
    .mutation(async ({ ctx, input }) => {
      let identity: { userId?: string | null; email?: string | null } = {};

      try {
        const session = await auth.api.getSession({
          headers: new Headers(ctx.req.headers as Record<string, string>),
        });
        if (session?.user) {
          identity = { userId: session.user.id, email: session.user.email };
        }
      } catch {
        // A failed session lookup must not sink the report — fall through and
        // file it anonymously.
      }

      try {
        return await feedbackService.submitFeedback({
          ...input,
          identity,
          userAgent: (ctx.req.headers["user-agent"] as string | undefined) ?? null,
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to submit feedback",
        });
      }
    }),
});
