import { db, eq, and, desc, gte, lt, count } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { formFieldViewsTable } from "@repo/database/models/form-field-view";
import { requireViewer } from "../form";

import {
  getFormAnalyticsInput,
  type GetFormAnalyticsInputType,
  getSubmissionsListInput,
  type GetSubmissionsListInputType,
  getDetailedAnalyticsInput,
  type GetDetailedAnalyticsInputType,
  recordFieldAnswerInput,
  type RecordFieldAnswerInputType,
} from "./model";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

class AnalyticsService {
  /**
   * Returns all summary analytics for a single form in one call.
   * Ownership is verified before querying.
   */
  public async getFormAnalytics(payload: GetFormAnalyticsInputType & { ownerId: string }) {
    const { formId } = await getFormAnalyticsInput.parseAsync(payload);
    const { ownerId: userId } = payload;

    await requireViewer(formId, userId);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Run all DB queries in parallel
    const [totalResponseRow, deviceRows, recentTimestamps] = await Promise.all([
      // Total submissions (all time)
      db
        .select({ value: count() })
        .from(formSubmissionsTable)
        .where(eq(formSubmissionsTable.formId, formId)),

      // Device breakdown from submissions
      db
        .select({ deviceType: formSubmissionsTable.deviceType, value: count() })
        .from(formSubmissionsTable)
        .where(eq(formSubmissionsTable.formId, formId))
        .groupBy(formSubmissionsTable.deviceType),

      // Submission timestamps for last 30 days (no values jsonb — just timestamps)
      db
        .select({ createdAt: formSubmissionsTable.createdAt })
        .from(formSubmissionsTable)
        .where(
          and(
            eq(formSubmissionsTable.formId, formId),
            gte(formSubmissionsTable.createdAt, thirtyDaysAgo),
          ),
        ),
    ]);

    const totalResponses = Number(totalResponseRow[0]?.value ?? 0);

    // ─── Device breakdown ─────────────────────────────────────────────────
    // Sourced from form_submissions.device_type, so this counts the devices
    // people submitted from — not everyone who opened the form. Rows with a
    // null device_type (submitted before the column existed) are skipped
    // rather than bucketed into desktop, which would fabricate a reading.
    const deviceMap: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0 };
    deviceRows.forEach((r) => {
      if (!r.deviceType) return;
      const n = Number(r.value);
      const dev = r.deviceType.toLowerCase();
      if (dev.includes("mobile")) deviceMap["mobile"] = (deviceMap["mobile"] ?? 0) + n;
      else if (dev.includes("tablet")) deviceMap["tablet"] = (deviceMap["tablet"] ?? 0) + n;
      else deviceMap["desktop"] = (deviceMap["desktop"] ?? 0) + n;
    });
    const deviceBreakdown = Object.entries(deviceMap).map(([device, cnt]) => ({
      device,
      count: cnt,
    }));

    // ─── Daily trends (last 30 days, zero-filled) ─────────────────────────
    const dailyMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dailyMap[key] = 0;
    }
    recentTimestamps.forEach((s) => {
      const key = new Date(s.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (dailyMap[key] !== undefined) dailyMap[key]++;
    });
    const dailyTrends = Object.entries(dailyMap).map(([date, cnt]) => ({ date, count: cnt }));

    // ─── Peak day of week ─────────────────────────────────────────────────
    const dowMap: Record<number, number> = {};
    for (let d = 0; d < 7; d++) dowMap[d] = 0;
    recentTimestamps.forEach((s) => {
      const dow = new Date(s.createdAt).getDay();
      dowMap[dow] = (dowMap[dow] ?? 0) + 1;
    });
    const peakDowEntry = Object.entries(dowMap).reduce(
      (best, [d, cnt]) => (cnt > best.count ? { day: Number(d), count: cnt } : best),
      { day: 0, count: 0 },
    );
    const peakDay = peakDowEntry.count > 0 ? (DAYS[peakDowEntry.day] ?? null) : null;

    // ─── Averages ─────────────────────────────────────────────────────────
    const avgSubmissionsPerDay = parseFloat((recentTimestamps.length / 30).toFixed(1));
    const avgSubmissionsPerWeek = parseFloat((recentTimestamps.length / (30 / 7)).toFixed(1));

    return {
      totalResponses,
      deviceBreakdown,
      dailyTrends,
      peakDay,
      avgSubmissionsPerDay,
      avgSubmissionsPerWeek,
    };
  }

  /**
   * Detailed analytics: per-question distributions, day-of-week breakdown,
   * 30/60/90d totals, and response velocity (first 24h after publish).
   */
  public async getDetailedAnalytics(payload: GetDetailedAnalyticsInputType & { ownerId: string }) {
    const { formId } = await getDetailedAnalyticsInput.parseAsync(payload);
    const { ownerId: userId } = payload;

    await requireViewer(formId, userId);

    const formRows = await db
      .select({
        id: formsTable.id,
        publishedAt: formsTable.publishedAt,
      })
      .from(formsTable)
      .where(eq(formsTable.id, formId));

    if (!formRows[0]) throw new Error("Form not found");
    const form = formRows[0];

    const now = new Date();
    const ago30 = new Date(now);
    ago30.setDate(now.getDate() - 30);
    ago30.setHours(0, 0, 0, 0);
    const ago60 = new Date(now);
    ago60.setDate(now.getDate() - 60);
    ago60.setHours(0, 0, 0, 0);
    const ago90 = new Date(now);
    ago90.setDate(now.getDate() - 90);
    ago90.setHours(0, 0, 0, 0);

    const [
      fields,
      allSubmissions,
      count30d,
      count60d,
      count90d,
      referrerRows,
      utmRows,
      fieldViewRows,
      rawFieldViewRows,
    ] = await Promise.all([
      db
        .select({
          id: formFieldsTable.id,
          label: formFieldsTable.label,
          type: formFieldsTable.type,
          options: formFieldsTable.options,
        })
        .from(formFieldsTable)
        .where(eq(formFieldsTable.formId, formId)),

      db
        .select({
          values: formSubmissionsTable.values,
          createdAt: formSubmissionsTable.createdAt,
          timeSpentMs: formSubmissionsTable.timeSpentMs,
        })
        .from(formSubmissionsTable)
        .where(eq(formSubmissionsTable.formId, formId))
        .orderBy(desc(formSubmissionsTable.createdAt))
        .limit(5000), // safety cap — enough for any real analytics calculation

      db
        .select({ value: count() })
        .from(formSubmissionsTable)
        .where(
          and(eq(formSubmissionsTable.formId, formId), gte(formSubmissionsTable.createdAt, ago30)),
        ),

      db
        .select({ value: count() })
        .from(formSubmissionsTable)
        .where(
          and(eq(formSubmissionsTable.formId, formId), gte(formSubmissionsTable.createdAt, ago60)),
        ),

      db
        .select({ value: count() })
        .from(formSubmissionsTable)
        .where(
          and(eq(formSubmissionsTable.formId, formId), gte(formSubmissionsTable.createdAt, ago90)),
        ),

      // Top referrers from submissions
      db
        .select({ referrer: formSubmissionsTable.referrer, value: count() })
        .from(formSubmissionsTable)
        .where(eq(formSubmissionsTable.formId, formId))
        .groupBy(formSubmissionsTable.referrer),

      // UTM source breakdown from submissions
      db
        .select({ utmSource: formSubmissionsTable.utmSource, value: count() })
        .from(formSubmissionsTable)
        .where(eq(formSubmissionsTable.formId, formId))
        .groupBy(formSubmissionsTable.utmSource),

      // Per-field answer counts from form_field_views (the real completion source)
      db
        .select({ fieldId: formFieldViewsTable.fieldId, value: count() })
        .from(formFieldViewsTable)
        .where(eq(formFieldViewsTable.formId, formId))
        .groupBy(formFieldViewsTable.fieldId),

      // Raw field view rows with values — used for question distribution
      db
        .select({
          fieldId: formFieldViewsTable.fieldId,
          value: formFieldViewsTable.value,
          createdAt: formFieldViewsTable.createdAt,
        })
        .from(formFieldViewsTable)
        .where(eq(formFieldViewsTable.formId, formId))
        .orderBy(desc(formFieldViewsTable.createdAt)),
    ]);
    // ─── Day-of-week breakdown ─────────────────────────────────────────────
    const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dowMap: Record<number, number> = {};
    for (let d = 0; d < 7; d++) dowMap[d] = 0;
    allSubmissions.forEach((s) => {
      const dow = new Date(s.createdAt).getDay();
      dowMap[dow] = (dowMap[dow] ?? 0) + 1;
    });
    const dowBreakdown = SHORT_DAYS.map((day, i) => ({ day, count: dowMap[i] ?? 0 }));

    // ─── Response velocity (first 24h after publish) ───────────────────────
    let velocityFirst24h = 0;
    if (form.publishedAt) {
      const publishedAt = new Date(form.publishedAt);
      const cutoff = new Date(publishedAt.getTime() + 24 * 60 * 60 * 1000);
      velocityFirst24h = allSubmissions.filter((s) => {
        const t = new Date(s.createdAt);
        return t >= publishedAt && t <= cutoff;
      }).length;
    }

    // ─── Per-question distribution ─────────────────────────────────────────
    // Primary source: rawFieldViewRows (every Next click with the answer value)
    // This includes partial fills — people who answered but didn't submit.
    // Falls back to allSubmissions for any field that has no field view records yet.
    const TEXT_TYPES = ["TEXT", "TEXTAREA", "EMAIL", "NUMBER", "PHONE", "URL", "DATE", "TIME"];
    const CHOICE_TYPES_SET = ["SELECT", "RADIO", "CHECKBOX"];

    const totalSubmissions = allSubmissions.length;

    // Group rawFieldViewRows by fieldId
    const fieldViewsByField = new Map<string, Array<{ value: unknown; createdAt: Date }>>();
    rawFieldViewRows.forEach((r) => {
      if (!fieldViewsByField.has(r.fieldId)) fieldViewsByField.set(r.fieldId, []);
      fieldViewsByField.get(r.fieldId)!.push({ value: r.value, createdAt: r.createdAt });
    });

    const questionDistribution = fields.map((field) => {
      // Use rawFieldViewRows if available, otherwise fall back to allSubmissions
      const fieldViewEntries = fieldViewsByField.get(field.id);
      const useFieldViews = fieldViewEntries && fieldViewEntries.length > 0;

      // Build the answers array from whichever source is available
      const answers: Array<{ value: unknown }> = useFieldViews
        ? fieldViewEntries!.filter(
            (e) => e.value !== null && e.value !== undefined && e.value !== "",
          )
        : allSubmissions
            .map((s) =>
              (s.values as Array<{ formFieldId: string; value: unknown }>).find(
                (v) => v.formFieldId === field.id,
              ),
            )
            .filter(
              (a): a is { formFieldId: string; value: unknown } =>
                a !== undefined && a.value !== null && a.value !== "",
            );

      const totalAnswered = useFieldViews
        ? (fieldViewsByField.get(field.id)?.length ?? 0)
        : answers.length;

      if (CHOICE_TYPES_SET.includes(field.type)) {
        const valueCounts: Record<string, number> = {};
        answers.forEach((a) => {
          const vals = Array.isArray(a.value) ? a.value : [a.value];
          vals.forEach((v) => {
            const s = String(v);
            valueCounts[s] = (valueCounts[s] ?? 0) + 1;
          });
        });
        const optionCounts = Object.entries(valueCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([value, cnt]) => ({
            value,
            count: cnt,
            percent: answers.length > 0 ? parseFloat(((cnt / answers.length) * 100).toFixed(1)) : 0,
          }));
        return {
          fieldId: field.id,
          fieldLabel: field.label,
          fieldType: field.type,
          totalAnswered,
          optionCounts,
        };
      } else if (field.type === "RATING") {
        const nums = answers.map((a) => Number(a.value)).filter((n) => !isNaN(n));
        const averageRating =
          nums.length > 0
            ? parseFloat((nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1))
            : 0;
        const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        nums.forEach((n) => {
          const clamped = Math.min(5, Math.max(1, Math.round(n)));
          ratingCounts[clamped] = (ratingCounts[clamped] ?? 0) + 1;
        });
        const ratingDistribution = [1, 2, 3, 4, 5].map((r) => ({
          rating: r,
          count: ratingCounts[r] ?? 0,
          percent:
            nums.length > 0
              ? parseFloat((((ratingCounts[r] ?? 0) / nums.length) * 100).toFixed(1))
              : 0,
        }));
        return {
          fieldId: field.id,
          fieldLabel: field.label,
          fieldType: field.type,
          totalAnswered,
          averageRating,
          ratingDistribution,
        };
      } else if (field.type === "TOGGLE") {
        const yes = answers.filter((a) => a.value === true || a.value === "true").length;
        const no = answers.filter((a) => a.value === false || a.value === "false").length;
        return {
          fieldId: field.id,
          fieldLabel: field.label,
          fieldType: field.type,
          totalAnswered,
          toggleCounts: { yes, no },
        };
      } else if (TEXT_TYPES.includes(field.type)) {
        const textSamples = answers
          .slice(0, 5)
          .map((a) => String(a.value))
          .filter((s) => s.trim().length > 0);
        return {
          fieldId: field.id,
          fieldLabel: field.label,
          fieldType: field.type,
          totalAnswered,
          textSamples,
        };
      } else {
        return { fieldId: field.id, fieldLabel: field.label, fieldType: field.type, totalAnswered };
      }
    });

    // ─── Median response time (minutes from publishedAt to submission) ─────
    let medianResponseTime: number | null = null;
    if (form.publishedAt && allSubmissions.length > 0) {
      const publishedAt = new Date(form.publishedAt);
      const deltas = allSubmissions
        .map((s) => (new Date(s.createdAt).getTime() - publishedAt.getTime()) / 60000)
        .filter((d) => d >= 0)
        .sort((a, b) => a - b);
      if (deltas.length > 0) {
        const mid = Math.floor(deltas.length / 2);
        medianResponseTime =
          deltas.length % 2 === 0
            ? parseFloat(((deltas[mid - 1]! + deltas[mid]!) / 2).toFixed(1))
            : parseFloat(deltas[mid]!.toFixed(1));
      }
    }

    // ─── Returning rate ────────────────────────────────────────────────────
    // Find the first EMAIL field (fallback: first TEXT field)
    const emailField =
      fields.find((f) => f.type === "EMAIL") ?? fields.find((f) => TEXT_TYPES.includes(f.type));
    let returningRate = 0;
    if (emailField && totalSubmissions > 0) {
      const valueCounts: Record<string, number> = {};
      allSubmissions.forEach((s) => {
        const entry = (s.values as Array<{ formFieldId: string; value: unknown }>).find(
          (v) => v.formFieldId === emailField.id,
        );
        if (entry?.value) {
          const key = String(entry.value).trim().toLowerCase();
          if (key) valueCounts[key] = (valueCounts[key] ?? 0) + 1;
        }
      });
      const duplicateCount = Object.values(valueCounts)
        .filter((c) => c > 1)
        .reduce((sum, c) => sum + c, 0);
      returningRate = parseFloat(((duplicateCount / totalSubmissions) * 100).toFixed(1));
    }

    // ─── Peak day ──────────────────────────────────────────────────────────
    const fullDayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const peakEntry = dowBreakdown.reduce(
      (best, entry, i) => (entry.count > best.count ? { count: entry.count, idx: i } : best),
      { count: 0, idx: 0 },
    );
    const peakDay = peakEntry.count > 0 ? (fullDayNames[peakEntry.idx] ?? null) : null;

    // ─── Field completion rates ────────────────────────────────────────────
    // Source: form_field_views — one row per field per visitor who answered it
    // and clicked Next. Denominator: the most-answered field, which stands in
    // for "people who started the form" now that page views aren't tracked.
    // The first question is almost always the most answered, so this gives
    // relative drop-off: e.g. 4 answered field A, 2 answered field B →
    // A=100%, B=50%. Falls back to total submissions when no field
    // interactions have been recorded.
    // Build a map of fieldId → answer count from form_field_views
    const fieldViewMap = new Map<string, number>(
      fieldViewRows.map((r) => [r.fieldId, Number(r.value)]),
    );
    const maxFieldInteractions = fieldViewRows.reduce((m, r) => Math.max(m, Number(r.value)), 0);
    const denominator = maxFieldInteractions > 0 ? maxFieldInteractions : totalSubmissions;

    const fieldCompletionRates = fields.map((field) => {
      const answeredCount = fieldViewMap.get(field.id) ?? 0;
      const rate =
        denominator > 0 ? parseFloat(((answeredCount / denominator) * 100).toFixed(1)) : 0;
      return { fieldId: field.id, fieldLabel: field.label, rate };
    });

    // ─── Avg time spent (from timeSpentMs column) ─────────────────────────
    const timings = allSubmissions
      .map((s) => s.timeSpentMs)
      .filter((t): t is number => t !== null && t !== undefined && t > 0);
    const avgTimeSpentMs =
      timings.length > 0 ? Math.round(timings.reduce((s, t) => s + t, 0) / timings.length) : null;

    // ─── Top referrers ─────────────────────────────────────────────────────
    const topReferrers = referrerRows
      .filter((r) => r.referrer !== null && r.referrer !== undefined && r.referrer !== "")
      .map((r) => {
        let domain = r.referrer ?? "direct";
        try {
          domain = new URL(r.referrer ?? "").hostname.replace(/^www\./, "");
        } catch {}
        return { referrer: domain, count: Number(r.value) };
      })
      .reduce(
        (acc, cur) => {
          const existing = acc.find((a) => a.referrer === cur.referrer);
          if (existing) {
            existing.count += cur.count;
          } else {
            acc.push({ ...cur });
          }
          return acc;
        },
        [] as { referrer: string; count: number }[],
      )
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Add "Direct" entry for null/empty referrers
    const directCount = referrerRows
      .filter((r) => !r.referrer || r.referrer === "")
      .reduce((s, r) => s + Number(r.value), 0);
    if (directCount > 0) topReferrers.push({ referrer: "Direct", count: directCount });
    topReferrers.sort((a, b) => b.count - a.count);

    // ─── UTM source breakdown ──────────────────────────────────────────────
    const utmSources = utmRows
      .filter((r) => r.utmSource !== null && r.utmSource !== undefined && r.utmSource !== "")
      .map((r) => ({ source: r.utmSource ?? "unknown", count: Number(r.value) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      dowBreakdown,
      trend30d: Number(count30d[0]?.value ?? 0),
      trend60d: Number(count60d[0]?.value ?? 0),
      trend90d: Number(count90d[0]?.value ?? 0),
      velocityFirst24h,
      questionDistribution,
      medianResponseTime,
      returningRate,
      peakDay,
      fieldCompletionRates,
      avgTimeSpentMs,
      topReferrers,
      utmSources,
    };
  }

  /**
   * Returns submissions for the UI table with cursor-based pagination.
   *
   * The cursor is the `createdAt` ISO timestamp of the last row from the
   * previous page. The server returns up to `limit` rows older than that
   * timestamp, plus a `nextCursor` if more rows exist. Cursor pagination
   * is stable under inserts (offset pagination would shift as new rows
   * arrive — the next page could repeat or skip rows).
   */
  public async getSubmissionsList(payload: GetSubmissionsListInputType & { ownerId: string }) {
    const { formId, cursor, limit } = await getSubmissionsListInput.parseAsync(payload);
    const { ownerId: userId } = payload;

    await requireViewer(formId, userId);

    const pageSize = limit ?? 50;
    const cursorDate = cursor ? new Date(cursor) : null;
    const whereClause = cursorDate
      ? and(eq(formSubmissionsTable.formId, formId), lt(formSubmissionsTable.createdAt, cursorDate))
      : eq(formSubmissionsTable.formId, formId);

    // Fetch pageSize+1 to peek at whether another page exists without a
    // separate COUNT round-trip.
    const rows = await db
      .select()
      .from(formSubmissionsTable)
      .where(whereClause)
      .orderBy(desc(formSubmissionsTable.createdAt))
      .limit(pageSize + 1);

    const hasMore = rows.length > pageSize;
    const submissions = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore
      ? submissions[submissions.length - 1]!.createdAt.toISOString()
      : null;

    return { submissions, nextCursor };
  }

  /**
   * Records that a visitor answered a specific field and clicked Next.
   * Stores the actual answer value for use in question distribution analytics.
   * Called by the public form page on each Next click — no auth required.
   * Powers accurate per-field completion rates in Pro analytics.
   */
  public async recordFieldAnswer(payload: RecordFieldAnswerInputType) {
    const { formId, fieldId, value } = await recordFieldAnswerInput.parseAsync(payload);
    await db.insert(formFieldViewsTable).values({
      formId,
      fieldId,
      value: value ?? null,
    });
    return { success: true };
  }
}

export default AnalyticsService;
