import { z } from "zod";
import { getFormFieldOutput } from "../form-field/model";
import { getFormSegmentOutput } from "../form-segment/model";
import { getLogicRuleOutput } from "../form-logic/model";

export type FormRole = "owner" | "editor" | "viewer";

export interface FormPermissions {
  builder: {
    canView: boolean;
    canEdit: boolean;
  };
  analytics: {
    canView: boolean;
  };
  responses: {
    canView: boolean;
  };
  settings: {
    canDelete: boolean;
    canPublish: boolean;
    canArchive: boolean;
    canShare: boolean;
  };
}

export const createFormInput = z.object({
  title: z.string().trim().min(1).max(150).describe("Title of the form"),
  description: z.string().trim().max(2000).optional().describe("Description of the form"),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug may only contain lowercase letters, digits, and hyphens",
    )
    .describe("Unique slug for the form URL"),
  ownerId: z.string().describe("Owner user ID"),
});

export type CreateFormInputType = z.infer<typeof createFormInput>;

export const listFormsByUserIdInput = z.object({
  userId: z.string().describe("Owner user ID"),
});

export type ListFormsByUserIdInputType = z.infer<typeof listFormsByUserIdInput>;

export const getFormInput = z.object({
  id: z.string().uuid().describe("Form ID"),
});
export type GetFormInputType = z.infer<typeof getFormInput>;

export const formPermissionsSchema = z.object({
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

export type FormPermissionsType = z.infer<typeof formPermissionsSchema>;

export const questionLayoutZodEnum = z.enum([
  "AUTO",
  "ONE_PER_PAGE",
  "SEGMENT_PER_PAGE",
  "ALL_AT_ONCE",
]);
export type QuestionLayout = z.infer<typeof questionLayoutZodEnum>;

export const getFormOutput = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  slug: z.string(),
  isPublished: z.boolean(),
  isArchived: z.boolean(),
  isOpen: z.boolean(),
  expiresAt: z.any().nullable().optional(),
  questionLayout: questionLayoutZodEnum
    .optional()
    .describe("How many questions a respondent sees at once"),

  requireSignIn: z.boolean().optional(),
  collectRespondentEmail: z.boolean().optional(),
  oneResponsePerRespondent: z.boolean().optional(),
  allowedEmailDomains: z.array(z.string()).nullable().optional(),
  thankYouMessage: z.string().nullable().optional(),

  submissionsCount: z.number().nullable().optional(),
  createdAt: z.any(),
  updatedAt: z.any(),
  publishedAt: z.any().nullable().optional(),
  ownerEmail: z.string().nullable().optional(),
  role: z.enum(["owner", "editor", "viewer"]).optional(),
  permissions: formPermissionsSchema.optional(),
});
export type GetFormOutputType = z.infer<typeof getFormOutput>;

export const getFormByIdOutput = getFormOutput.extend({
  fields: z.array(getFormFieldOutput),
  segments: z.array(getFormSegmentOutput),
  logicRules: z.array(getLogicRuleOutput),
});
export type GetFormByIdOutputType = z.infer<typeof getFormByIdOutput>;

export const publishFormOutput = z.object({
  id: z.string().uuid().describe("ID of the published form"),
});
export type PublishFormOutputType = z.infer<typeof publishFormOutput>;

export const archiveFormOutput = z.object({
  success: z.boolean().describe("Whether archiving was successful"),
});
export type ArchiveFormOutputType = z.infer<typeof archiveFormOutput>;

export const unarchiveFormOutput = z.object({
  success: z.boolean().describe("Whether unarchiving was successful"),
});
export type UnarchiveFormOutputType = z.infer<typeof unarchiveFormOutput>;

export const deleteFormInput = z.object({
  id: z.string().uuid().describe("Form ID to delete"),
});
export type DeleteFormInputType = z.infer<typeof deleteFormInput>;

export const deleteFormOutput = z.object({
  success: z.boolean().describe("Whether deletion was successful"),
});
export type DeleteFormOutputType = z.infer<typeof deleteFormOutput>;

export const getDashboardStatsInput = z.object({
  userId: z.string().describe("Owner user ID"),
});
export type GetDashboardStatsInputType = z.infer<typeof getDashboardStatsInput>;

export const getDashboardStatsOutput = z.object({
  totalSketches: z.number(),
  publishedSketches: z.number(),
  totalResponses: z.number(),
  responsesThisMonth: z.number(),
  recentForms: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      createdAt: z.any(),
      isPublished: z.boolean(),
      submissionsCount: z.number(),
    }),
  ),
  trends: z.array(
    z.object({
      date: z.string(),
      count: z.number(),
    }),
  ),
});
export type GetDashboardStatsOutputType = z.infer<typeof getDashboardStatsOutput>;

// Collaborator Schemas
export const listCollaboratorsInput = z.object({
  formId: z.string().uuid().describe("Form ID"),
});
export type ListCollaboratorsInputType = z.infer<typeof listCollaboratorsInput>;

export const listCollaboratorsOutput = z.array(
  z.object({
    id: z.string().describe("Collaborator user ID"),
    name: z.string(),
    email: z.string().email(),
    role: z.enum(["viewer", "editor"]),
    addedBy: z.string().nullable().optional(),
  }),
);
export type ListCollaboratorsOutputType = z.infer<typeof listCollaboratorsOutput>;

export const addCollaboratorInput = z.object({
  formId: z.string().uuid().describe("Form ID"),
  email: z.string().email().describe("Collaborator email"),
  role: z.enum(["viewer", "editor"]).describe("Collaborator role"),
});
export type AddCollaboratorInputType = z.infer<typeof addCollaboratorInput>;

export const addCollaboratorOutput = z.object({
  success: z.boolean(),
});
export type AddCollaboratorOutputType = z.infer<typeof addCollaboratorOutput>;

export const updateCollaboratorRoleInput = z.object({
  formId: z.string().uuid().describe("Form ID"),
  userId: z.string().describe("Collaborator user ID"),
  role: z.enum(["viewer", "editor"]).describe("New collaborator role"),
});
export type UpdateCollaboratorRoleInputType = z.infer<typeof updateCollaboratorRoleInput>;

export const updateCollaboratorRoleOutput = z.object({
  success: z.boolean(),
});
export type UpdateCollaboratorRoleOutputType = z.infer<typeof updateCollaboratorRoleOutput>;

export const removeCollaboratorInput = z.object({
  formId: z.string().uuid().describe("Form ID"),
  userId: z.string().describe("Collaborator user ID"),
});
export type RemoveCollaboratorInputType = z.infer<typeof removeCollaboratorInput>;

export const removeCollaboratorOutput = z.object({
  success: z.boolean(),
});
export type RemoveCollaboratorOutputType = z.infer<typeof removeCollaboratorOutput>;

export const transferOwnershipInput = z.object({
  formId: z.string().uuid().describe("Form ID"),
  targetUserId: z.string().describe("Target user ID"),
});
export type TransferOwnershipInputType = z.infer<typeof transferOwnershipInput>;

export const transferOwnershipOutput = z.object({
  success: z.boolean(),
});
export type TransferOwnershipOutputType = z.infer<typeof transferOwnershipOutput>;

export const updateFormSettingsInput = z.object({
  id: z.string().uuid().describe("Form ID"),
  title: z.string().trim().min(1).max(150).describe("Title of the form"),
  description: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .describe("Description of the form"),
  isOpen: z.boolean().describe("Whether the form accepts submissions"),
  expiresAt: z.any().nullable().optional().describe("Expiration date ISO string or Date object"),
  questionLayout: questionLayoutZodEnum
    .optional()
    .describe("How many questions a respondent sees at once"),

  requireSignIn: z.boolean().optional().describe("Respondents must be signed in"),
  collectRespondentEmail: z
    .boolean()
    .optional()
    .describe("Record the signed-in respondent's account email; implies requireSignIn"),
  oneResponsePerRespondent: z
    .boolean()
    .optional()
    .describe("Limit each account to one response; implies requireSignIn"),
  allowedEmailDomains: z
    .array(z.string().trim().min(1).max(255))
    .max(20)
    .optional()
    .nullable()
    .describe(
      "Email domains permitted to respond, matched as a suffix so subdomains are included; implies requireSignIn",
    ),
  thankYouMessage: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .describe("Shown on the thank-you screen in addition to the default confirmation"),
});
export type UpdateFormSettingsInputType = z.infer<typeof updateFormSettingsInput>;

export const updateFormSettingsOutput = z.object({
  success: z.boolean().describe("Whether settings update was successful"),
});
export type UpdateFormSettingsOutputType = z.infer<typeof updateFormSettingsOutput>;
