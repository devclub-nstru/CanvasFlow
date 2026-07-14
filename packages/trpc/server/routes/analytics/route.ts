import {
  authenticatedProcedure,
  proAuthenticatedProcedure,
  publicProcedure,
  router,
} from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import {
  getFormAnalyticsInputModel,
  getFormAnalyticsOutputModel,
  getSubmissionsListInputModel,
  getSubmissionsListOutputModel,
  getProAnalyticsInput as getProAnalyticsInputModel,
  getProAnalyticsOutput as getProAnalyticsOutputModel,
  recordViewInputModel,
  recordViewOutputModel,
  recordFieldAnswerInputModel,
  recordFieldAnswerOutputModel,
} from "./model";
import { analyticsService } from "../../services";

const TAGS = ["Analytics"];
const getPath = generatePath("/analytics");

export const analyticsRouter = router({
  /**
   * GET /analytics/getFormAnalytics/{formId}
   * Returns all free-tier analytics metrics for a form in a single call:
   *   - totalResponses, totalViews, completionRate
   *   - deviceViews (desktop / mobile / tablet from view records)
   *   - dailyTrends (last 30 days, zero-filled)
   *   - hourlyDistribution (0–23 buckets)
   *   - peakHour, peakDay, avgSubmissionsPerDay, avgSubmissionsPerWeek
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
   * POST /analytics/recordView
   * Records a view for a public form. Called by the public form page.
   * Public — no auth required.
   */
  recordView: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/recordView"),
        tags: TAGS,
        protect: false,
      },
    })
    .input(recordViewInputModel)
    .output(recordViewOutputModel)
    .mutation(async ({ input }) => {
      return analyticsService.recordView(input);
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
   * GET /analytics/getProAnalytics/{formId}
   * Pro-tier: day-of-week breakdown, 30/60/90d trend totals,
   * response velocity (first 24h after publish), and per-question
   * response distribution for SELECT, CHECKBOX, RADIO, RATING, TOGGLE fields.
   *
   * Returns FORBIDDEN for Free-tier users.
   */
  getProAnalytics: proAuthenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getProAnalytics/{formId}"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(getProAnalyticsInputModel)
    .output(getProAnalyticsOutputModel)
    .query(async ({ input, ctx }) => {
      return analyticsService.getProAnalytics({
        formId: input.formId,
        ownerId: ctx.user.id,
      });
    }),
});
