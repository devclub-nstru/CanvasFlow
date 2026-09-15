import { count, countDistinct, db, inArray, sql, sum } from "@repo/database";
import { accountsTable, usersTable } from "@repo/database/models/auth";
import { formsTable } from "@repo/database/models/form";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { formUploadsTable } from "@repo/database/models/form-upload";
import { feedbackTable } from "@repo/database/models/feedback";

import {
  getPlatformStatsInput,
  type GetPlatformStatsInputType,
  type GetPlatformStatsOutputType,
} from "./model";

/* Every date boundary below is computed in SQL — `current_date`,
 * `date_trunc`, `generate_series` — and never in JavaScript.
 *
 * That is not stylistic. These columns are `timestamp without time zone` and
 * the database runs on UTC, while the Node process runs on whatever the host's
 * timezone happens to be. Mixing the two gives two different answers for "what
 * day is this": a submission at 19:18 UTC is the 14th to Postgres and the 15th
 * to a machine in IST, so a JS-bucketed chart disagreed with a SQL-filtered
 * "today" count by one row. One clock, and it is the database's. */

/* One row per day across the window, zero-filled.
 *
 * generate_series supplies the days, so a day with no activity still appears —
 * a chart that omits empty days draws a straight line across the gap and reads
 * as activity that never happened. */
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

      /* Distinct users per provider — there is one account row per provider, so
       * a plain count would double-count anyone who linked two. */
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
          storageBytes: sum(formUploadsTable.sizeBytes),
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
    ]);

    const byProvider = new Map(providerRows.map((r) => [r.providerId, Number(r.value)]));

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
        /* `sum` comes back as a string (or null on an empty table) because the
         * total can exceed a 32-bit int. */
        storageBytes: Number(uploadTotals[0]?.storageBytes ?? 0),
      },
      feedback: {
        open: Number(feedbackTotals[0]?.open ?? 0),
        total: Number(feedbackTotals[0]?.total ?? 0),
      },
      submissionTrend: (submissionTrendRows as unknown as { rows: Array<{ date: string; count: number }> }).rows,
      signupTrend: (signupTrendRows as unknown as { rows: Array<{ date: string; count: number }> }).rows,
    };
  }
}

export default AdminService;
