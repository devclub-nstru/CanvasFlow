import { TRPCError } from "@trpc/server";

import { publicProcedure, router } from "../../trpc";
import { auth } from "../../auth";
import { feedbackService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import { submitFeedbackInput, submitFeedbackOutput } from "@repo/services/feedback/model";

const TAGS = ["Feedback"];
const getPath = generatePath("/feedback");

export const feedbackRouter = router({
  // POST /feedback/submit
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
      } catch {}

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
