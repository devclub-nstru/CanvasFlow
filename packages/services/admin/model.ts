import { z } from "zod";

const trendPoint = z.object({
  date: z.string().describe("Short label, e.g. 'Mar 4'"),
  count: z.number(),
});

export const getPlatformStatsInput = z.object({
  days: z.number().int().min(7).max(90).default(30),
});
export type GetPlatformStatsInputType = z.infer<typeof getPlatformStatsInput>;

export const getPlatformStatsOutput = z.object({
  users: z.object({
    total: z.number(),
    verified: z.number(),
    newThisWeek: z.number(),
    newThisMonth: z.number(),
    admins: z.number().describe("Accounts with admin or superadmin"),
  }),
  providers: z.object({
    credential: z.number(),
    google: z.number(),
    github: z.number(),
  }),
  forms: z.object({
    total: z.number(),
    published: z.number(),
    archived: z.number(),
  }),
  submissions: z.object({
    total: z.number(),
    thisMonth: z.number(),
    today: z.number(),
  }),
  uploads: z.object({
    total: z.number(),
    failed: z.number(),
  }),
  feedback: z.object({
    open: z.number(),
    total: z.number(),
  }),
  /* Presence, from `users.last_seen_at` rather than sign-in records — see the
   * column's own note for why those two are not the same thing. */
  active: z.object({
    daily: z.number(),
    weekly: z.number(),
    monthly: z.number(),
  }),
  activation: z.object({
    creators: z.number().describe("Accounts that own at least one form"),
    rate: z.number().describe("Creators as a percentage of all accounts, 0-100"),
  }),
  /* Which field types people actually place, commonest first. */
  fieldTypes: z.array(z.object({ type: z.string(), count: z.number() })),
  topForms: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      slug: z.string(),
      ownerEmail: z.string().nullable(),
      submissionCount: z.number(),
    }),
  ),
  submissionTrend: z.array(trendPoint),
  signupTrend: z.array(trendPoint),
});
export type GetPlatformStatsOutputType = z.infer<typeof getPlatformStatsOutput>;

/* ── User management ────────────────────────────────────────────────────── */

export const userRoleSchema = z.enum(["user", "admin", "superadmin"]);

export const listUsersInput = z.object({
  query: z.string().trim().max(200).optional().describe("Matches name or email"),
  role: userRoleSchema.optional(),
  suspended: z.boolean().optional().describe("Only suspended accounts"),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});
export type ListUsersInputType = z.infer<typeof listUsersInput>;

const userRow = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  role: userRoleSchema,
  suspendedAt: z.any().nullable(),
  suspendedReason: z.string().nullable(),
  createdAt: z.any(),
  formCount: z.number(),
});

export const listUsersOutput = z.object({
  items: z.array(userRow),
  total: z.number(),
});
export type ListUsersOutputType = z.infer<typeof listUsersOutput>;

export const getUserDetailInput = z.object({ userId: z.string() });
export type GetUserDetailInputType = z.infer<typeof getUserDetailInput>;

export const getUserDetailOutput = userRow.extend({
  providers: z.array(z.string()),
  hasPassword: z.boolean(),
  submissionCount: z.number().describe("Responses across every form they own"),
  sessions: z.array(
    z.object({
      id: z.string(),
      ipAddress: z.string().nullable(),
      userAgent: z.string().nullable(),
      createdAt: z.any(),
      expiresAt: z.any(),
    }),
  ),
  forms: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      slug: z.string(),
      isPublished: z.boolean(),
      isArchived: z.boolean(),
      submissionCount: z.number(),
      createdAt: z.any(),
    }),
  ),
});
export type GetUserDetailOutputType = z.infer<typeof getUserDetailOutput>;

export const setSuspendedInput = z.object({
  userId: z.string(),
  suspended: z.boolean(),
  reason: z.string().trim().max(300).optional().describe("Shown to them at sign-in"),
});
export type SetSuspendedInputType = z.infer<typeof setSuspendedInput>;

export const listPendingSignupsOutput = z.array(
  z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    attempts: z.number(),
    createdAt: z.any(),
    expiresAt: z.any(),
    expired: z.boolean(),
  }),
);
export type ListPendingSignupsOutputType = z.infer<typeof listPendingSignupsOutput>;

/* ── Audit log ──────────────────────────────────────────────────────────── */

export const adminAuditActionSchema = z.enum([
  "user.suspended",
  "user.unsuspended",
  "user.signed_out",
  "user.password_reset",
  "admin.granted",
  "admin.revoked",
  "signup.code_resent",
  "signup.deleted",
  "feedback.claimed",
  "feedback.released",
  "feedback.status_changed",
]);
export type AdminAuditActionType = z.infer<typeof adminAuditActionSchema>;

export const auditCategorySchema = z.enum(["user", "admin", "feedback", "signup"]);
export type AuditCategoryType = z.infer<typeof auditCategorySchema>;

export const listAuditInput = z.object({
  action: adminAuditActionSchema.optional(),
  category: auditCategorySchema.optional().describe("All actions in one group"),
  targetUserId: z.string().optional().describe("Only entries about this account"),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListAuditInputType = z.infer<typeof listAuditInput>;

export const listAuditOutput = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      actorId: z.string().nullable(),
      actorEmail: z.string(),
      action: adminAuditActionSchema,
      targetUserId: z.string().nullable(),
      targetLabel: z.string().nullable(),
      detail: z.any().nullable(),
      createdAt: z.any(),
    }),
  ),
  total: z.number(),
});
export type ListAuditOutputType = z.infer<typeof listAuditOutput>;

/* ── Pending signups ────────────────────────────────────────────────────── */

export const pendingSignupActionInput = z.object({
  id: z.string().describe("Pending signup row id"),
});
export type PendingSignupActionInputType = z.infer<typeof pendingSignupActionInput>;
