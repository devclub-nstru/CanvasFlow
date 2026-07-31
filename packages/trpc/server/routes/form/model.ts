import { z } from "zod";

export const createFormInputModel = z.object({
  title: z
    .string()
    .min(1, "Title must be at least 1 character")
    .max(150, "Title must be at most 150 characters")
    .describe("Title of the form"),
  description: z.string().optional().describe("Description of the form"),
  slug: z
    .string()
    .min(1, "Slug must be at least 1 character")
    .max(150, "Slug must be at most 150 characters")
    .describe("Unique slug for the form"),
});

export const createFormOutputModel = z.object({
  id: z.string().uuid().describe("ID of the created form"),
});

export type CreateFormInputModelType = z.infer<typeof createFormInputModel>;
export type CreateFormOutputModelType = z.infer<typeof createFormOutputModel>;

export const listFormsByUserIdInputModel = z.undefined();

export const formPermissionsSchemaModel = z.object({
  builder: z.object({
    canView: z.boolean(),
    canEdit: z.boolean(),
  }),
  analytics: z.object({
    canView: z.boolean(),
  }),
  responses: z.object({
    canView: z.boolean(),
  }),
  settings: z.object({
    canDelete: z.boolean(),
    canPublish: z.boolean(),
    canArchive: z.boolean(),
    canShare: z.boolean(),
  }),
});

export const listFormsByUserIdOutputModel = z.array(
  z.object({
    id: z.string().uuid().describe("ID of the form"),
    title: z.string().describe("Title of the form"),
    description: z.string().nullable().optional().describe("Description of the form"),
    slug: z.string().describe("Unique slug for the form"),
    isPublished: z.boolean().describe("Whether form is published"),
    isArchived: z.boolean().describe("Whether form is archived"),
    isOpen: z.boolean().describe("Whether form is open for submissions"),
    createdAt: z.any().describe("Creation timestamp"),
    updatedAt: z.any().describe("Last updated timestamp"),
    publishedAt: z.any().nullable().optional().describe("Published timestamp"),
    submissionsCount: z.number().describe("Total number of submissions"),
    ownerEmail: z.string().nullable().optional().describe("Owner email"),
    role: z.enum(["owner", "editor", "viewer"]).describe("Collaborator role"),
    permissions: formPermissionsSchemaModel.describe("Permissions matrix"),
  }),
);

export type ListFormsByUserIdInputModelType = z.infer<typeof listFormsByUserIdInputModel>;
export type ListFormsByUserIdOutputModelType = z.infer<typeof listFormsByUserIdOutputModel>;

export {
  createFormFieldInput as createFormFieldInputModel,
  createFormFieldOutput as createFormFieldOutputModel,
  updateFormFieldInput as updateFormFieldInputModel,
  updateFormFieldOutput as updateFormFieldOutputModel,
  deleteFormFieldInput as deleteFormFieldInputModel,
  deleteFormFieldOutput as deleteFormFieldOutputModel,
  getFormFieldInput as getFormFieldInputModel,
  getFormFieldOutput as getFormFieldOutputModel,
  listFormFieldsInput as listFormFieldsInputModel,
  listFormFieldsOutput as listFormFieldsOutputModel,
} from "@repo/services/form-field/model";

export {
  getFormInput as getFormInputModel,
  getFormOutput as getFormOutputModel,
  getFormByIdOutput as getFormByIdOutputModel,
  publishFormOutput as publishFormOutputModel,
  deleteFormInput as deleteFormInputModel,
  deleteFormOutput as deleteFormOutputModel,
  getDashboardStatsOutput as getDashboardStatsOutputModel,
  listCollaboratorsInput as listCollaboratorsInputModel,
  listCollaboratorsOutput as listCollaboratorsOutputModel,
  addCollaboratorInput as addCollaboratorInputModel,
  addCollaboratorOutput as addCollaboratorOutputModel,
  updateCollaboratorRoleInput as updateCollaboratorRoleInputModel,
  updateCollaboratorRoleOutput as updateCollaboratorRoleOutputModel,
  removeCollaboratorInput as removeCollaboratorInputModel,
  removeCollaboratorOutput as removeCollaboratorOutputModel,
  transferOwnershipInput as transferOwnershipInputModel,
  transferOwnershipOutput as transferOwnershipOutputModel,
  updateFormSettingsInput as updateFormSettingsInputModel,
  updateFormSettingsOutput as updateFormSettingsOutputModel,
} from "@repo/services/form/model";

export {
  submitFormInput as submitFormInputModel,
  submitFormOutput as submitFormOutputModel,
} from "@repo/services/form-submission/model";

export {
  createFormSegmentInput as createFormSegmentInputModel,
  createFormSegmentOutput as createFormSegmentOutputModel,
  updateFormSegmentInput as updateFormSegmentInputModel,
  updateFormSegmentOutput as updateFormSegmentOutputModel,
  deleteFormSegmentInput as deleteFormSegmentInputModel,
  deleteFormSegmentOutput as deleteFormSegmentOutputModel,
  listFormSegmentsInput as listFormSegmentsInputModel,
  listFormSegmentsOutput as listFormSegmentsOutputModel,
} from "@repo/services/form-segment/model";

export {
  saveDraftInput as saveDraftInputModel,
  saveDraftOutput as saveDraftOutputModel,
  getDraftInput as getDraftInputModel,
  getDraftOutput as getDraftOutputModel,
  deleteDraftInput as deleteDraftInputModel,
  deleteDraftOutput as deleteDraftOutputModel,
} from "@repo/services/form-draft/model";

export {
  createLogicRuleInput as createLogicRuleInputModel,
  createLogicRuleOutput as createLogicRuleOutputModel,
  updateLogicRuleInput as updateLogicRuleInputModel,
  updateLogicRuleOutput as updateLogicRuleOutputModel,
  deleteLogicRuleInput as deleteLogicRuleInputModel,
  deleteLogicRuleOutput as deleteLogicRuleOutputModel,
  listLogicRulesInput as listLogicRulesInputModel,
  listLogicRulesOutput as listLogicRulesOutputModel,
} from "@repo/services/form-logic/model";
