import { authenticatedProcedure, publicProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import {
  getFormAnalyticsInputModel,
  getFormAnalyticsOutputModel,
  getSubmissionsListInputModel,
  getSubmissionsListOutputModel,
  getDetailedAnalyticsInput as getDetailedAnalyticsInputModel,
  getDetailedAnalyticsOutput as getDetailedAnalyticsOutputModel,
  recordFieldAnswerInputModel,
  recordFieldAnswerOutputModel,
} from "./model";
import { analyticsService } from "../../services";

const TAGS = ["Analytics"];
const getPath = generatePath("/analytics");

export const analyticsRouter = router({
  /**
   * GET /analytics/getFormAnalytics/{formId}
   * Returns all summary analytics metrics for a form in a single call:
   *   - totalResponses
   *   - deviceBreakdown (desktop / mobile / tablet from submission records)
   *   - dailyTrends (last 30 days, zero-filled)
   *   - peakDay, avgSubmissionsPerDay, avgSubmissionsPerWeek
   */
  getFormAnalytics: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getFormAnalytics/{formId}"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(getFormAnalyticsInputModel)
    .output(getFormAnalyticsOutputModel)
    .query(async ({ input, ctx }) => {
      return analyticsService.getFormAnalytics({
        formId: input.formId,
        ownerId: ctx.user.id,
      });
    }),

  /**
   * GET /analytics/getSubmissions/{formId}
   * Returns the full submission rows (including values jsonb) for the table view.
   * Kept separate from getFormAnalytics so the heavy jsonb is only loaded on demand.
   */
  getSubmissions: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getSubmissions/{formId}"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(getSubmissionsListInputModel)
    .output(getSubmissionsListOutputModel)
    .query(async ({ input, ctx }) => {
      return analyticsService.getSubmissionsList({
        formId: input.formId,
        ownerId: ctx.user.id,
        cursor: input.cursor ?? null,
        limit: input.limit,
      });
    }),

  /**
   * POST /analytics/recordFieldAnswer
   * Records that a visitor answered a field and clicked Next.
   * Called by the public form page on each Next click — no auth required.
   */
  recordFieldAnswer: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/recordFieldAnswer"),
        tags: TAGS,
        protect: false,
      },
    })
    .input(recordFieldAnswerInputModel)
    .output(recordFieldAnswerOutputModel)
    .mutation(async ({ input }) => {
      return analyticsService.recordFieldAnswer(input);
    }),

  /**
   * GET /analytics/getDetailedAnalytics/{formId}
   * Day-of-week breakdown, 30/60/90d trend totals, response velocity (first
   * 24h after publish), and per-question response distribution for SELECT,
   * CHECKBOX, RADIO, RATING, TOGGLE fields.
   *
   * Available to anyone who can see the form. This was gated behind a
   * subscription tier; tiers no longer exist, so the ordinary authenticated
   * procedure is the whole check.
   */
  getDetailedAnalytics: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getDetailedAnalytics/{formId}"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(getDetailedAnalyticsInputModel)
    .output(getDetailedAnalyticsOutputModel)
    .query(async ({ input, ctx }) => {
      return analyticsService.getDetailedAnalytics({
        formId: input.formId,
        ownerId: ctx.user.id,
      });
    }),
});
