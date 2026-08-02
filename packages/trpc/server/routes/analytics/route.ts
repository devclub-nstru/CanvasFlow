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
  // GET /analytics/getFormAnalytics/{formId}
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

  // GET /analytics/getSubmissions/{formId}
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

  // POST /analytics/recordFieldAnswer
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

  // GET /analytics/getDetailedAnalytics/{formId}
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
