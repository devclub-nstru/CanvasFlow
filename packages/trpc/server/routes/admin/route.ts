import { TRPCError } from "@trpc/server";

import { z } from "zod";

import { adminProcedure, router } from "../../trpc";
import { adminService } from "../../services";
import { resendSignupCodeFor, revokeAllSessionsForUser, triggerPasswordReset } from "../../auth";
import { generatePath } from "../../utils/path-generator";
import {
  getPlatformStatsInput,
  getPlatformStatsOutput,
  getUserDetailInput,
  getUserDetailOutput,
  listPendingSignupsOutput,
  listUsersInput,
  listUsersOutput,
  setSuspendedInput,
  listAuditInput,
  listAuditOutput,
  pendingSignupActionInput,
} from "@repo/services/admin/model";

const TAGS = ["Admin"];
const getPath = generatePath("/admin");

export const adminRouter = router({
  // GET /admin/stats
  platformStats: adminProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/stats"), tags: TAGS, protect: true },
    })
    .input(getPlatformStatsInput)
    .output(getPlatformStatsOutput)
    .query(async ({ input }) => {
      try {
        return await adminService.getPlatformStats(input);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to load platform stats",
        });
      }
    }),
  // GET /admin/users
  listUsers: adminProcedure
    .meta({ openapi: { method: "GET", path: getPath("/users"), tags: TAGS, protect: true } })
    .input(listUsersInput)
    .output(listUsersOutput)
    .query(async ({ input }) => adminService.listUsers(input)),

  // GET /admin/users/detail
  getUserDetail: adminProcedure
    .meta({ openapi: { method: "GET", path: getPath("/users/detail"), tags: TAGS, protect: true } })
    .input(getUserDetailInput)
    .output(getUserDetailOutput)
    .query(async ({ input }) => {
      try {
        return await adminService.getUserDetail(input);
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: error instanceof Error ? error.message : "No such account",
        });
      }
    }),

  // POST /admin/users/suspend
  setSuspended: adminProcedure
    .meta({ openapi: { method: "POST", path: getPath("/users/suspend"), tags: TAGS, protect: true } })
    .input(setSuspendedInput)
    .output(getUserDetailOutput)
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't suspend yourself." });
      }

      try {
        await adminService.setSuspended(input);

        if (input.suspended) await revokeAllSessionsForUser(input.userId);

        const detail = await adminService.getUserDetail({ userId: input.userId });

        await adminService.recordAudit({
          actorId: ctx.user.id,
          actorEmail: ctx.user.email,
          action: input.suspended ? "user.suspended" : "user.unsuspended",
          targetUserId: detail.id,
          targetLabel: detail.email,
          detail: input.reason ? { reason: input.reason } : undefined,
        });

        return detail;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Couldn't change that account",
        });
      }
    }),

  // POST /admin/users/signout
  forceSignOut: adminProcedure
    .meta({ openapi: { method: "POST", path: getPath("/users/signout"), tags: TAGS, protect: true } })
    .input(z.object({ userId: z.string() }))
    .output(z.object({ revoked: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const revoked = await revokeAllSessionsForUser(input.userId);

      const target = await adminService
        .getUserDetail({ userId: input.userId })
        .catch(() => null);

      await adminService.recordAudit({
        actorId: ctx.user.id,
        actorEmail: ctx.user.email,
        action: "user.signed_out",
        targetUserId: input.userId,
        targetLabel: target?.email ?? null,
        detail: { revoked },
      });

      return { revoked };
    }),

  // POST /admin/users/reset-password
  sendPasswordReset: adminProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/users/reset-password"), tags: TAGS, protect: true },
    })
    .input(z.object({ userId: z.string() }))
    .output(z.object({ sent: z.boolean(), reason: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const result = await triggerPasswordReset(input.userId);

      if (result.sent) {
        const target = await adminService
          .getUserDetail({ userId: input.userId })
          .catch(() => null);

        await adminService.recordAudit({
          actorId: ctx.user.id,
          actorEmail: ctx.user.email,
          action: "user.password_reset",
          targetUserId: input.userId,
          targetLabel: target?.email ?? null,
        });
      }

      return result;
    }),

  // GET /admin/pending-signups
  listPendingSignups: adminProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/pending-signups"), tags: TAGS, protect: true },
    })
    .input(z.undefined())
    .output(listPendingSignupsOutput)
    .query(async () => adminService.listPendingSignups()),
  // POST /admin/pending-signups/resend
  resendSignupCode: adminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/pending-signups/resend"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(pendingSignupActionInput)
    .output(z.object({ sent: z.boolean(), reason: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const result = await resendSignupCodeFor(input.id);

      if (result.sent) {
        await adminService.recordAudit({
          actorId: ctx.user.id,
          actorEmail: ctx.user.email,
          action: "signup.code_resent",
          targetLabel: result.email,
        });
      }

      return { sent: result.sent, reason: result.reason };
    }),

  // POST /admin/pending-signups/delete
  deletePendingSignup: adminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/pending-signups/delete"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(pendingSignupActionInput)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const pending = await adminService.getPendingSignup(input);
        await adminService.deletePendingSignup(input);

        await adminService.recordAudit({
          actorId: ctx.user.id,
          actorEmail: ctx.user.email,
          action: "signup.deleted",
          targetLabel: pending.email,
        });

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Couldn't clear that signup",
        });
      }
    }),

  // GET /admin/audit
  listAudit: adminProcedure
    .meta({ openapi: { method: "GET", path: getPath("/audit"), tags: TAGS, protect: true } })
    .input(listAuditInput)
    .output(listAuditOutput)
    .query(async ({ input }) => adminService.listAudit(input)),
});
