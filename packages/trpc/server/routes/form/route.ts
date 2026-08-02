import { z } from "zod";
import { authenticatedProcedure, publicProcedure, router } from "../../trpc";
import { auth } from "../../auth";
import { generatePath } from "../../utils/path-generator";
import {
  createFormInputModel,
  createFormOutputModel,
  listFormsByUserIdInputModel,
  listFormsByUserIdOutputModel,
  createFormFieldInputModel,
  createFormFieldOutputModel,
  updateFormFieldInputModel,
  updateFormFieldOutputModel,
  deleteFormFieldInputModel,
  deleteFormFieldOutputModel,
  getFormFieldInputModel,
  getFormFieldOutputModel,
  getFormInputModel,
  getFormOutputModel,
  getFormByIdOutputModel,
  publishFormOutputModel,
  deleteFormInputModel,
  deleteFormOutputModel,
  submitFormInputModel,
  submitFormOutputModel,
  listFormFieldsInputModel,
  listFormFieldsOutputModel,
  getDashboardStatsOutputModel,
  listCollaboratorsInputModel,
  listCollaboratorsOutputModel,
  addCollaboratorInputModel,
  addCollaboratorOutputModel,
  updateCollaboratorRoleInputModel,
  updateCollaboratorRoleOutputModel,
  removeCollaboratorInputModel,
  removeCollaboratorOutputModel,
  transferOwnershipInputModel,
  transferOwnershipOutputModel,
  updateFormSettingsInputModel,
  updateFormSettingsOutputModel,
  createFormSegmentInputModel,
  createFormSegmentOutputModel,
  updateFormSegmentInputModel,
  updateFormSegmentOutputModel,
  deleteFormSegmentInputModel,
  deleteFormSegmentOutputModel,
  listFormSegmentsInputModel,
  listFormSegmentsOutputModel,
  createLogicRuleInputModel,
  createLogicRuleOutputModel,
  updateLogicRuleInputModel,
  updateLogicRuleOutputModel,
  deleteLogicRuleInputModel,
  deleteLogicRuleOutputModel,
  listLogicRulesInputModel,
  listLogicRulesOutputModel,
  saveDraftInputModel,
  saveDraftOutputModel,
  getDraftInputModel,
  getDraftOutputModel,
  deleteDraftInputModel,
  deleteDraftOutputModel,
} from "./model";
import {
  formService,
  formFieldService,
  formSubmissionService,
  formSegmentService,
  formLogicService,
  formDraftService,
} from "../../services";

const TAGS = ["Forms"];
const getPath = generatePath("/forms");

export const formRouter = router({
  createForm: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createForm"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(createFormInputModel)
    .output(createFormOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { title, description, slug } = input;
      const { id } = await formService.createForm({
        title,
        description,
        slug,
        ownerId: ctx.user.id,
      });

      return { id };
    }),

  listFormsByUserId: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/listFormsByUserId"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(listFormsByUserIdInputModel)
    .output(listFormsByUserIdOutputModel)
    .query(async ({ ctx }) => {
      const forms = await formService.listFormsByUserId({ userId: ctx.user.id });
      return forms;
    }),

  createFormField: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createFormField"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(createFormFieldInputModel)
    .output(createFormFieldOutputModel)
    .mutation(async ({ input, ctx }) => {
      const result = await formFieldService.createFormField({ ...input, userId: ctx.user.id });
      return result;
    }),

  updateFormField: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/updateFormField"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(updateFormFieldInputModel)
    .output(updateFormFieldOutputModel)
    .mutation(async ({ input, ctx }) => {
      const result = await formFieldService.updateFormField({ ...input, userId: ctx.user.id });
      return result;
    }),

  deleteFormField: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/deleteFormField"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(deleteFormFieldInputModel)
    .output(deleteFormFieldOutputModel)
    .mutation(async ({ input, ctx }) => {
      const result = await formFieldService.deleteFormField({ ...input, userId: ctx.user.id });
      return result;
    }),

  getFormField: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getFormField/{id}"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(getFormFieldInputModel)
    .output(getFormFieldOutputModel)
    .query(async ({ input, ctx }) => {
      const result = await formFieldService.getFormField({ ...input, userId: ctx.user.id });
      return result;
    }),

  getForm: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getForm/{id}"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(getFormInputModel)
    .output(getFormOutputModel)
    .query(async ({ input, ctx }) => {
      const result = await formService.getForm({ ...input, userId: ctx.user.id });
      return result;
    }),

  listFormFields: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/listFormFields/{formId}"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(listFormFieldsInputModel)
    .output(listFormFieldsOutputModel)
    .query(async ({ input, ctx }) => {
      const result = await formFieldService.listFormFields({ ...input, userId: ctx.user.id });
      return result;
    }),

  getFormById: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getFormById/{id}"),
        tags: TAGS,
        protect: false,
      },
    })
    .input(getFormInputModel)
    .output(getFormByIdOutputModel)
    .query(async ({ input }) => {
      const result = await formService.getFormById(input);
      return result;
    }),

  publishForm: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/publishForm"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(getFormInputModel)
    .output(publishFormOutputModel)
    .mutation(async ({ input, ctx }) => {
      const result = await formService.publishForm({ ...input, ownerId: ctx.user.id });
      return result;
    }),

  getDashboardStats: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getDashboardStats"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(z.undefined())
    .output(getDashboardStatsOutputModel)
    .query(async ({ ctx }) => {
      const result = await formService.getDashboardStats({ userId: ctx.user.id });
      return result;
    }),

  deleteForm: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/deleteForm"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(deleteFormInputModel)
    .output(deleteFormOutputModel)
    .mutation(async ({ input, ctx }) => {
      const result = await formService.deleteForm({ id: input.id, ownerId: ctx.user.id });
      return result;
    }),

  submitForm: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/submitForm"),
        tags: TAGS,
        protect: false,
      },
    })
    .input(submitFormInputModel)
    .output(submitFormOutputModel)
    .mutation(async ({ input, ctx }) => {
      // Read the session if present
      const session = await auth.api.getSession({
        headers: new Headers(ctx.req.headers as Record<string, string>),
      });

      const respondent = session?.user ? { id: session.user.id, email: session.user.email } : null;

      return formSubmissionService.submitForm({ ...input, respondent });
    }),

  listCollaborators: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/listCollaborators"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(listCollaboratorsInputModel)
    .output(listCollaboratorsOutputModel)
    .query(async ({ input, ctx }) => {
      return formService.listCollaborators({ ...input, userId: ctx.user.id });
    }),

  addCollaborator: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/addCollaborator"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(addCollaboratorInputModel)
    .output(addCollaboratorOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formService.addCollaborator({ ...input, requesterId: ctx.user.id });
    }),

  updateCollaboratorRole: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/updateCollaboratorRole"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(updateCollaboratorRoleInputModel)
    .output(updateCollaboratorRoleOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formService.updateCollaboratorRole({ ...input, requesterId: ctx.user.id });
    }),

  removeCollaborator: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/removeCollaborator"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(removeCollaboratorInputModel)
    .output(removeCollaboratorOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formService.removeCollaborator({ ...input, requesterId: ctx.user.id });
    }),

  transferOwnership: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/transferOwnership"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(transferOwnershipInputModel)
    .output(transferOwnershipOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formService.transferOwnership({ ...input, requesterId: ctx.user.id });
    }),

  updateFormSettings: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/updateFormSettings"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(updateFormSettingsInputModel)
    .output(updateFormSettingsOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formService.updateFormSettings({ ...input, requesterId: ctx.user.id });
    }),

  // Segments

  createFormSegment: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createFormSegment"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(createFormSegmentInputModel)
    .output(createFormSegmentOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formSegmentService.createFormSegment({ ...input, userId: ctx.user.id });
    }),

  updateFormSegment: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/updateFormSegment"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(updateFormSegmentInputModel)
    .output(updateFormSegmentOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formSegmentService.updateFormSegment({ ...input, userId: ctx.user.id });
    }),

  deleteFormSegment: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/deleteFormSegment"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(deleteFormSegmentInputModel)
    .output(deleteFormSegmentOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formSegmentService.deleteFormSegment({ ...input, userId: ctx.user.id });
    }),

  listFormSegments: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/listFormSegments"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(listFormSegmentsInputModel)
    .output(listFormSegmentsOutputModel)
    .query(async ({ input, ctx }) => {
      return formSegmentService.listFormSegments({ ...input, userId: ctx.user.id });
    }),

  // Conditional branching

  createLogicRule: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createLogicRule"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(createLogicRuleInputModel)
    .output(createLogicRuleOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formLogicService.createLogicRule({ ...input, userId: ctx.user.id });
    }),

  updateLogicRule: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/updateLogicRule"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(updateLogicRuleInputModel)
    .output(updateLogicRuleOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formLogicService.updateLogicRule({ ...input, userId: ctx.user.id });
    }),

  deleteLogicRule: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/deleteLogicRule"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(deleteLogicRuleInputModel)
    .output(deleteLogicRuleOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formLogicService.deleteLogicRule({ ...input, userId: ctx.user.id });
    }),

  listLogicRules: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/listLogicRules"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(listLogicRulesInputModel)
    .output(listLogicRulesOutputModel)
    .query(async ({ input, ctx }) => {
      return formLogicService.listLogicRules({ ...input, userId: ctx.user.id });
    }),

  // Drafts

  saveDraft: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/saveDraft"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(saveDraftInputModel)
    .output(saveDraftOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formDraftService.saveDraft({ ...input, userId: ctx.user.id });
    }),

  getDraft: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getDraft/{formId}"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(getDraftInputModel)
    .output(getDraftOutputModel)
    .query(async ({ input, ctx }) => {
      return formDraftService.getDraft({ ...input, userId: ctx.user.id });
    }),

  deleteDraft: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/deleteDraft"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(deleteDraftInputModel)
    .output(deleteDraftOutputModel)
    .mutation(async ({ input, ctx }) => {
      return formDraftService.deleteDraft({ ...input, userId: ctx.user.id });
    }),
});
