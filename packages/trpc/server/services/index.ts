import FormService from "@repo/services/form";
import FormFieldService from "@repo/services/form-field";
import FormSegmentService from "@repo/services/form-segment";
import FormLogicService from "@repo/services/form-logic";
import FormDraftService from "@repo/services/form-draft";
import FormSubmissionService from "@repo/services/form-submission";
import AnalyticsService from "@repo/services/analytics";
import FeedbackService from "@repo/services/feedback";

export const formService = new FormService();
export const formFieldService = new FormFieldService();
export const formSegmentService = new FormSegmentService();
export const formLogicService = new FormLogicService();
export const formDraftService = new FormDraftService();
export const formSubmissionService = new FormSubmissionService();
export const analyticsService = new AnalyticsService();
export const feedbackService = new FeedbackService();
