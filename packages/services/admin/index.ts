import {
  and,
  asc,
  count,
  countDistinct,
  db,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "@repo/database";
import { accountsTable, pendingSignupsTable, sessionsTable, usersTable } from "@repo/database/models/auth";
import { adminAuditLogTable, type AdminAuditAction } from "@repo/database/models/admin-audit";
import { formsTable } from "@repo/database/models/form";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { formUploadsTable } from "@repo/database/models/form-upload";
import { feedbackTable } from "@repo/database/models/feedback";

import {
  getPlatformStatsInput,
  getUserDetailInput,
  listUsersInput,
  setSuspendedInput,
  type GetPlatformStatsInputType,
  type GetPlatformStatsOutputType,
  type GetUserDetailInputType,
  type GetUserDetailOutputType,
  type ListPendingSignupsOutputType,
  type ListUsersInputType,
  type ListUsersOutputType,
  type SetSuspendedInputType,
  listAuditInput,
  pendingSignupActionInput,
  type ListAuditInputType,
  type ListAuditOutputType,
  type PendingSignupActionInputType,
  type AuditCategoryType,
} from "./model";

function dailyTrend(table: typeof formSubmissionsTable | typeof usersTable, days: number) {
  return db.execute<{ date: string; count: number }>(sql`
    select
      to_char(d.day, 'Mon FMDD') as date,
      coalesce(c.n, 0)::int as count
    from generate_series(
      current_date - make_interval(days => ${days - 1}),
      current_date,
      interval '1 day'
    ) as d(day)
    left join (
      select date_trunc('day', ${table.createdAt}) as day, count(*) as n
      from ${table}
      where ${table.createdAt} >= current_date - make_interval(days => ${days - 1})
      group by 1
    ) as c on c.day = d.day
    order by d.day
  `);
}


const AUDIT_CATEGORY_ACTIONS: Record<AuditCategoryType, AdminAuditAction[]> = {
  user: ["user.suspended", "user.unsuspended", "user.signed_out", "user.password_reset"],
  admin: ["admin.granted", "admin.revoked"],
  feedback: ["feedback.claimed", "feedback.released", "feedback.status_changed"],
  signup: ["signup.code_resent", "signup.deleted"],
};

const userFormCount = sql<number>`(
  select count(*) from "forms" where "forms"."owner_id" = "users"."id"
)`.mapWith(Number);

class AdminService {
  public async getPlatformStats(
    payload: GetPlatformStatsInputType,
  ): Promise<GetPlatformStatsOutputType> {
    const { days } = await getPlatformStatsInput.parseAsync(payload);

    const [
      userTotals,
      adminCount,
      providerRows,
      formTotals,
      submissionTotals,
      uploadTotals,
      feedbackTotals,
      submissionTrendRows,
      signupTrendRows,
      activeRows,
      creatorRows,
      fieldTypeRows,
      topFormRows,
    ] = await Promise.all([
      db
        .select({
          total: count(),
          verified: sql<number>`count(*) filter (where ${usersTable.emailVerified})`.mapWith(
            Number,
          ),
          newThisWeek:
            sql<number>`count(*) filter (where ${usersTable.createdAt} >= current_date - interval '6 days')`.mapWith(
              Number,
            ),
          newThisMonth:
            sql<number>`count(*) filter (where ${usersTable.createdAt} >= date_trunc('month', current_date))`.mapWith(
              Number,
            ),
        })
        .from(usersTable),

      db
        .select({ value: count() })
        .from(usersTable)
        .where(inArray(usersTable.role, ["admin", "superadmin"])),

      db
        .select({ providerId: accountsTable.providerId, value: countDistinct(accountsTable.userId) })
        .from(accountsTable)
        .groupBy(accountsTable.providerId),

      db
        .select({
          total: count(),
          published: sql<number>`count(*) filter (where ${formsTable.isPublished})`.mapWith(Number),
          archived: sql<number>`count(*) filter (where ${formsTable.isArchived})`.mapWith(Number),
        })
        .from(formsTable),

      db
        .select({
          total: count(),
          thisMonth:
            sql<number>`count(*) filter (where ${formSubmissionsTable.createdAt} >= date_trunc('month', current_date))`.mapWith(
              Number,
            ),
          today:
            sql<number>`count(*) filter (where ${formSubmissionsTable.createdAt} >= current_date)`.mapWith(
              Number,
            ),
        })
        .from(formSubmissionsTable),

      db
        .select({
          total: count(),
          failed: sql<number>`count(*) filter (where ${formUploadsTable.status} = 'failed')`.mapWith(
            Number,
          ),
        })
        .from(formUploadsTable),

      db
        .select({
          total: count(),
          open: sql<number>`count(*) filter (where ${feedbackTable.status} = 'open')`.mapWith(
            Number,
          ),
        })
        .from(feedbackTable),

      dailyTrend(formSubmissionsTable, days),
      dailyTrend(usersTable, days),

      /* Presence windows, all from one row so the three counts are consistent
       * with each other — three separate queries could straddle a midnight. */
      db
        .select({
          daily:
            sql<number>`count(*) filter (where ${usersTable.lastSeenAt} >= now() - interval '1 day')`.mapWith(
              Number,
            ),
          weekly:
            sql<number>`count(*) filter (where ${usersTable.lastSeenAt} >= now() - interval '7 days')`.mapWith(
              Number,
            ),
          monthly:
            sql<number>`count(*) filter (where ${usersTable.lastSeenAt} >= now() - interval '30 days')`.mapWith(
              Number,
            ),
        })
        .from(usersTable),

      /* Accounts that own at least one form. Distinct owners rather than a
       * join, so somebody with twenty forms still counts once. */
      db.select({ value: countDistinct(formsTable.ownerId) }).from(formsTable),

      db
        .select({ type: formFieldsTable.type, value: count() })
        .from(formFieldsTable)
        .groupBy(formFieldsTable.type)
        .orderBy(desc(count())),

      db
        .select({
          id: formsTable.id,
          title: formsTable.title,
          slug: formsTable.slug,
          ownerEmail: usersTable.email,
          submissionCount: count(formSubmissionsTable.id),
        })
        .from(formsTable)
        .leftJoin(formSubmissionsTable, eq(formSubmissionsTable.formId, formsTable.id))
        .leftJoin(usersTable, eq(formsTable.ownerId, usersTable.id))
        .groupBy(formsTable.id, usersTable.email)
        .orderBy(desc(count(formSubmissionsTable.id)))
        .limit(5),
    ]);

    const byProvider = new Map(providerRows.map((r) => [r.providerId, Number(r.value)]));
    const totalUsers = Number(userTotals[0]?.total ?? 0);
    const creators = Number(creatorRows[0]?.value ?? 0);

    return {
      users: {
        total: Number(userTotals[0]?.total ?? 0),
        verified: Number(userTotals[0]?.verified ?? 0),
        newThisWeek: Number(userTotals[0]?.newThisWeek ?? 0),
        newThisMonth: Number(userTotals[0]?.newThisMonth ?? 0),
        admins: Number(adminCount[0]?.value ?? 0),
      },
      providers: {
        credential: byProvider.get("credential") ?? 0,
        google: byProvider.get("google") ?? 0,
        github: byProvider.get("github") ?? 0,
      },
      forms: {
        total: Number(formTotals[0]?.total ?? 0),
        published: Number(formTotals[0]?.published ?? 0),
        archived: Number(formTotals[0]?.archived ?? 0),
      },
      submissions: {
        total: Number(submissionTotals[0]?.total ?? 0),
        thisMonth: Number(submissionTotals[0]?.thisMonth ?? 0),
        today: Number(submissionTotals[0]?.today ?? 0),
      },
      uploads: {
        total: Number(uploadTotals[0]?.total ?? 0),
        failed: Number(uploadTotals[0]?.failed ?? 0),
      },
      feedback: {
        open: Number(feedbackTotals[0]?.open ?? 0),
        total: Number(feedbackTotals[0]?.total ?? 0),
      },
      active: {
        daily: Number(activeRows[0]?.daily ?? 0),
        weekly: Number(activeRows[0]?.weekly ?? 0),
        monthly: Number(activeRows[0]?.monthly ?? 0),
      },
      activation: {
        creators,
        /* Guarded: an empty users table would otherwise divide by zero and
         * report NaN as a "rate". */
        rate: totalUsers > 0 ? Math.round((creators / totalUsers) * 100) : 0,
      },
      fieldTypes: fieldTypeRows.map((r) => ({ type: r.type, count: Number(r.value) })),
      topForms: topFormRows.map((r) => ({ ...r, submissionCount: Number(r.submissionCount) })),
      submissionTrend: (submissionTrendRows as unknown as { rows: Array<{ date: string; count: number }> }).rows,
      signupTrend: (signupTrendRows as unknown as { rows: Array<{ date: string; count: number }> }).rows,
    };
  }

  /* ── User management ──────────────────────────────────────────────────── */

  public async listUsers(payload: ListUsersInputType): Promise<ListUsersOutputType> {
    const input = await listUsersInput.parseAsync(payload);

    const q = input.query?.trim();
    const filters = [
      q ? or(ilike(usersTable.email, `%${q}%`), ilike(usersTable.name, `%${q}%`)) : undefined,
      input.role ? eq(usersTable.role, input.role) : undefined,
      input.suspended === true ? isNotNull(usersTable.suspendedAt) : undefined,
      input.suspended === false ? isNull(usersTable.suspendedAt) : undefined,
    ].filter(Boolean);

    const where = filters.length ? and(...(filters as never[])) : undefined;

    const items = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        emailVerified: usersTable.emailVerified,
        role: usersTable.role,
        suspendedAt: usersTable.suspendedAt,
        suspendedReason: usersTable.suspendedReason,
        createdAt: usersTable.createdAt,
        formCount: userFormCount,
      })
      .from(usersTable)
      .where(where)
      .orderBy(desc(usersTable.createdAt), asc(usersTable.id))
      .limit(input.limit)
      .offset(input.offset);

    const [totalRow] = await db.select({ value: count() }).from(usersTable).where(where);

    return { items, total: Number(totalRow?.value ?? 0) };
  }

  public async getUserDetail(payload: GetUserDetailInputType): Promise<GetUserDetailOutputType> {
    const { userId } = await getUserDetailInput.parseAsync(payload);

    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        emailVerified: usersTable.emailVerified,
        role: usersTable.role,
        suspendedAt: usersTable.suspendedAt,
        suspendedReason: usersTable.suspendedReason,
        createdAt: usersTable.createdAt,
        formCount: userFormCount,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) throw new Error("No such account");

    const [accounts, submissionRow, sessions, forms] = await Promise.all([
      db
        .select({ providerId: accountsTable.providerId, password: accountsTable.password })
        .from(accountsTable)
        .where(eq(accountsTable.userId, userId)),

      db
        .select({ value: count() })
        .from(formSubmissionsTable)
        .innerJoin(formsTable, eq(formSubmissionsTable.formId, formsTable.id))
        .where(eq(formsTable.ownerId, userId)),

      db
        .select({
          id: sessionsTable.id,
          ipAddress: sessionsTable.ipAddress,
          userAgent: sessionsTable.userAgent,
          createdAt: sessionsTable.createdAt,
          expiresAt: sessionsTable.expiresAt,
        })
        .from(sessionsTable)
        .where(and(eq(sessionsTable.userId, userId), gt(sessionsTable.expiresAt, new Date())))
        .orderBy(desc(sessionsTable.createdAt))
        .limit(20),

      db
        .select({
          id: formsTable.id,
          title: formsTable.title,
          slug: formsTable.slug,
          isPublished: formsTable.isPublished,
          isArchived: formsTable.isArchived,
          createdAt: formsTable.createdAt,
          submissionCount: count(formSubmissionsTable.id),
        })
        .from(formsTable)
        .leftJoin(formSubmissionsTable, eq(formSubmissionsTable.formId, formsTable.id))
        .where(eq(formsTable.ownerId, userId))
        .groupBy(formsTable.id)
        .orderBy(desc(formsTable.createdAt))
        .limit(20),
    ]);

    return {
      ...user,
      providers: accounts.map((a) => a.providerId),
      hasPassword: accounts.some((a) => a.providerId === "credential" && !!a.password),
      submissionCount: Number(submissionRow[0]?.value ?? 0),
      sessions,
      forms: forms.map((f) => ({ ...f, submissionCount: Number(f.submissionCount) })),
    };
  }

  public async setSuspended(payload: SetSuspendedInputType): Promise<GetUserDetailOutputType> {
    const input = await setSuspendedInput.parseAsync(payload);

    const [user] = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, input.userId))
      .limit(1);

    if (!user) throw new Error("No such account");

    if (input.suspended && user.role !== "user") {
      throw new Error("Remove their admin access first, then suspend the account.");
    }

    await db
      .update(usersTable)
      .set(
        input.suspended
          ? { suspendedAt: new Date(), suspendedReason: input.reason ?? null }
          : { suspendedAt: null, suspendedReason: null },
      )
      .where(eq(usersTable.id, input.userId));

    return this.getUserDetail({ userId: input.userId });
  }

  public async listPendingSignups(): Promise<ListPendingSignupsOutputType> {
    const rows = await db
      .select({
        id: pendingSignupsTable.id,
        email: pendingSignupsTable.email,
        name: pendingSignupsTable.name,
        attempts: pendingSignupsTable.attempts,
        createdAt: pendingSignupsTable.createdAt,
        expiresAt: pendingSignupsTable.expiresAt,
      })
      .from(pendingSignupsTable)
      .orderBy(desc(pendingSignupsTable.createdAt))
      .limit(50);

    const now = Date.now();
    return rows.map((r) => ({ ...r, expired: r.expiresAt.getTime() <= now }));
  }

  /* ── Audit log ────────────────────────────────────────────────────────── */

  public async recordAudit(entry: {
    actorId: string;
    actorEmail: string;
    action: AdminAuditAction;
    targetUserId?: string | null;
    targetLabel?: string | null;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await db.insert(adminAuditLogTable).values({
        actorId: entry.actorId,
        actorEmail: entry.actorEmail,
        action: entry.action,
        targetUserId: entry.targetUserId ?? null,
        targetLabel: entry.targetLabel ?? null,
        detail: entry.detail ?? null,
      });
    } catch (err) {
      console.error(
        `[admin] failed to write audit entry ${entry.action}: ` +
          `${err instanceof Error ? err.message : err}`,
      );
    }
  }

  public async listAudit(payload: ListAuditInputType): Promise<ListAuditOutputType> {
    const input = await listAuditInput.parseAsync(payload);

    const filters = [
      input.action ? eq(adminAuditLogTable.action, input.action) : undefined,
      input.category
        ? inArray(adminAuditLogTable.action, AUDIT_CATEGORY_ACTIONS[input.category])
        : undefined,
      input.targetUserId ? eq(adminAuditLogTable.targetUserId, input.targetUserId) : undefined,
    ].filter(Boolean);

    const where = filters.length ? and(...(filters as never[])) : undefined;

    const items = await db
      .select()
      .from(adminAuditLogTable)
      .where(where)
      .orderBy(desc(adminAuditLogTable.createdAt), asc(adminAuditLogTable.id))
      .limit(input.limit)
      .offset(input.offset);

    const [totalRow] = await db.select({ value: count() }).from(adminAuditLogTable).where(where);

    return { items, total: Number(totalRow?.value ?? 0) };
  }

  /* ── Pending signups ──────────────────────────────────────────────────── */

  public async getPendingSignup(payload: PendingSignupActionInputType) {
    const { id } = await pendingSignupActionInput.parseAsync(payload);

    const [row] = await db
      .select({
        id: pendingSignupsTable.id,
        email: pendingSignupsTable.email,
        expiresAt: pendingSignupsTable.expiresAt,
      })
      .from(pendingSignupsTable)
      .where(eq(pendingSignupsTable.id, id))
      .limit(1);

    if (!row) throw new Error("That signup is no longer pending.");
    return row;
  }

  public async deletePendingSignup(payload: PendingSignupActionInputType): Promise<void> {
    const { id } = await pendingSignupActionInput.parseAsync(payload);

    const deleted = await db
      .delete(pendingSignupsTable)
      .where(eq(pendingSignupsTable.id, id))
      .returning({ id: pendingSignupsTable.id });

    if (!deleted[0]) throw new Error("That signup is no longer pending.");
  }
}

export default AdminService;
