import { z } from "zod";

/* Platform-wide numbers for the admin overview.
 *
 * Everything here spans every account, which is exactly what makes it an admin
 * surface: the owner-scoped dashboard in `form` answers "how are my forms
 * doing", this answers "how is the platform doing". */

const trendPoint = z.object({
  date: z.string().describe("Short label, e.g. 'Mar 4'"),
  count: z.number(),
});

export const getPlatformStatsInput = z.object({
  /* 30 is the default because that is the window the chart shows; 90 is
   * offered for the same reason the owner dashboard offers it. */
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
  /* How people actually sign in. The counts overlap — one account can hold
   * both a password and a Google login — so they are not a partition of
   * `users.total` and must not be rendered as one. */
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
    storageBytes: z.number(),
  }),
  feedback: z.object({
    open: z.number(),
    total: z.number(),
  }),
  submissionTrend: z.array(trendPoint),
  signupTrend: z.array(trendPoint),
});
export type GetPlatformStatsOutputType = z.infer<typeof getPlatformStatsOutput>;
