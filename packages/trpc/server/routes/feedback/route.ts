import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, publicProcedure, router } from "../../trpc";
import { auth } from "../../auth";
import { feedbackService } from "../../services";
import { generatePath } from "../../utils/path-generator";
import {
  getFeedbackInput,
  getFeedbackOutput,
  listFeedbackInput,
  listFeedbackOutput,
  feedbackStatsOutput,
  submitFeedbackInput,
  submitFeedbackOutput,
  updateFeedbackInput,
  updateFeedbackOutput,
} from "@repo/services/feedback/model";

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


  // GET /feedback/admin/list
  listFeedback: adminProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/admin/list"), tags: TAGS, protect: true },
    })
    .input(listFeedbackInput)
    .output(listFeedbackOutput)
    .query(async ({ ctx, input }) => {
      return feedbackService.listFeedback({ ...input, viewerId: ctx.user.id });
    }),

  // GET /feedback/admin/stats
  feedbackStats: adminProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/admin/stats"), tags: TAGS, protect: true },
    })
    .input(z.void())
    .output(feedbackStatsOutput)
    .query(async ({ ctx }) => {
      return feedbackService.getFeedbackStats({ viewerId: ctx.user.id });
    }),

  // GET /feedback/admin/get
  getFeedback: adminProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/admin/get"), tags: TAGS, protect: true },
    })
    .input(getFeedbackInput)
    .output(getFeedbackOutput)
    .query(async ({ input }) => {
      try {
        return await feedbackService.getFeedback(input);
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "Feedback not found",
        });
      }
    }),

  // POST /feedback/admin/update
  updateFeedback: adminProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/admin/update"), tags: TAGS, protect: true },
    })
    .input(updateFeedbackInput)
    .output(updateFeedbackOutput)
    .mutation(async ({ ctx, input }) => {
      const { claim, ...rest } = input;

      /* The assignee is the session's own user, or nobody. The request never
       * gets to name one, so "assign this to someone else" is not a request
       * that can be expressed — not merely one the UI declines to send. */
      const assignedTo = claim === undefined ? undefined : claim ? ctx.user.id : null;

      try {
        return await feedbackService.updateFeedback({ ...rest, assignedTo });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to update feedback",
        });
      }
    }),
});
