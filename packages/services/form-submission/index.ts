import { db, eq, and, desc, gte, lt, count, usersTable } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { formViewsTable } from "@repo/database/models/form-view";
import {
  submitFormInput,
  type SubmitFormInputType,
  getSubmissionsInput,
  type GetSubmissionsInputType,
  recordViewInput,
  type RecordViewInputType,
} from "./model";

// Sentinel error message the client looks for to render the
// "already submitted" screen instead of a generic toast. Keep this
// string stable — the public form page matches against it.
export const ALREADY_SUBMITTED_ERROR = "ALREADY_SUBMITTED";

class FormSubmissionService {
  public async submitForm(payload: SubmitFormInputType) {
    const { formId, values, idempotencyKey, visitorId } = await submitFormInput.parseAsync(payload);

    const formResult = await db.select().from(formsTable).where(eq(formsTable.id, formId));
    const form = formResult[0];
    if (!form) {
      throw new Error("Form not found");
    }
    if (!form.isPublished) {
      throw new Error("Form is not published yet");
    }
    if (!form.isOpen) {
      throw new Error("Form is closed for submissions");
    }

    if (form.expiresAt && new Date() > new Date(form.expiresAt)) {
      throw new Error("Form has expired");
    }

    if (form.maxSubmissions !== null && form.maxSubmissions !== undefined) {
      const submissionsCountRows = await db
        .select({ value: count() })
        .from(formSubmissionsTable)
        .where(eq(formSubmissionsTable.formId, formId));
      const totalSubmissions = Number(submissionsCountRows[0]?.value ?? 0);
      if (totalSubmissions >= form.maxSubmissions) {
        throw new Error("Form has reached its submission limit");
      }
    }

    // One-submission-per-visitor enforcement. Visitors who can't write
    // localStorage (private mode, storage disabled) send a null
    // visitorId and skip this check — idempotency-key dedupe still
    // protects them from double-clicks within a single page session.
    if (visitorId) {
      const prior = await db
        .select({ id: formSubmissionsTable.id })
        .from(formSubmissionsTable)
        .where(
          and(
            eq(formSubmissionsTable.formId, formId),
            eq(formSubmissionsTable.visitorId, visitorId),
          ),
        )
        .limit(1);
      if (prior[0]) {
        throw new Error(ALREADY_SUBMITTED_ERROR);
      }
    }

    // Idempotency check — if the client supplied a key and we've already
    // recorded a submission for (form_id, idempotency_key), return the
    // existing one instead of inserting a duplicate. Stops double-clicks
    // and retried network requests from creating ghost submissions.
    if (idempotencyKey) {
      const existing = await db
        .select({ id: formSubmissionsTable.id })
        .from(formSubmissionsTable)
        .where(
          and(
            eq(formSubmissionsTable.formId, formId),
            eq(formSubmissionsTable.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      const firstExisting = existing[0];
      if (firstExisting) {
        return { id: firstExisting.id };
      }
    }

    const userResult = await db
      .select({ plan: usersTable.plan })
      .from(usersTable)
      .where(eq(usersTable.id, form.ownerId));
    const userPlan = userResult[0]?.plan || "Free";

    let submissionLimit = 1000;
    if (userPlan === "Pro") submissionLimit = 10000;
    else if (userPlan === "Pro+") submissionLimit = 50000;
    else if (userPlan === "Business") submissionLimit = 500000;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Count this month's submissions across all of the owner's forms in a
    // single COUNT query (no row materialization).
    const monthCountRows = await db
      .select({ value: count() })
      .from(formSubmissionsTable)
      .innerJoin(formsTable, eq(formSubmissionsTable.formId, formsTable.id))
      .where(
        and(
          eq(formsTable.ownerId, form.ownerId),
          gte(formSubmissionsTable.createdAt, startOfMonth),
        ),
      );

    const monthlyCount = Number(monthCountRows[0]?.value ?? 0);
    if (monthlyCount >= submissionLimit) {
      throw new Error(
        `This workspace has reached the limit of ${submissionLimit} submissions per month for the ${userPlan} tier.`,
      );
    }

    let insertResult;
    try {
      insertResult = await db
        .insert(formSubmissionsTable)
        .values({
          formId,
          values,
          idempotencyKey: idempotencyKey ?? null,
          visitorId: visitorId ?? null,
          referrer: (payload as any).referrer ?? null,
          utmSource: (payload as any).utmSource ?? null,
          utmMedium: (payload as any).utmMedium ?? null,
          utmCampaign: (payload as any).utmCampaign ?? null,
          timeSpentMs: (payload as any).timeSpentMs ?? null,
        })
        .returning({ id: formSubmissionsTable.id });
    } catch (err: any) {
      // Race condition: two parallel submits from the same visitor can
      // both pass the SELECT check above, then collide on the partial
      // unique index. Translate the Postgres 23505 unique violation
      // back into our sentinel so the client treats it the same way.
      const code = err?.code ?? err?.cause?.code;
      const msg = (err?.message ?? "") + " " + (err?.detail ?? "");
      if (
        code === "23505" ||
        /form_submissions_form_visitor_idx|form_submissions_form_idempotency_idx/.test(msg)
      ) {
        throw new Error(ALREADY_SUBMITTED_ERROR);
      }
      throw err;
    }

    const firstResult = insertResult[0];
    if (!firstResult) {
      throw new Error("Failed to submit form");
    }

    return {
      id: firstResult.id,
    };
  }

  public async getSubmissions(payload: GetSubmissionsInputType) {
    const { formId, ownerId, cursor, limit } = await getSubmissionsInput.parseAsync(payload);

    const formResult = await db
      .select()
      .from(formsTable)
      .where(and(eq(formsTable.id, formId), eq(formsTable.ownerId, ownerId)));
    if (!formResult[0]) {
      throw new Error("Form not found or unauthorized");
    }

    // Build the WHERE for the submissions page. When a cursor is supplied,
    // we paginate by createdAt rather than offset — stable under inserts.
    const cursorDate = cursor ? new Date(cursor) : null;
    const whereClause = cursorDate
      ? and(
          eq(formSubmissionsTable.formId, formId),
          // strict < cursor so the cursor row itself doesn't repeat
          // (cursorDate is the createdAt of the LAST row from the prior page).
          // `desc` ordering + `lt` = "older than the cursor".
          lt(formSubmissionsTable.createdAt, cursorDate),
        )
      : eq(formSubmissionsTable.formId, formId);

    // Fetch limit+1 so we know whether there's another page without a
    // second COUNT query.
    const [pageRows, deviceRows] = await Promise.all([
      db
        .select()
        .from(formSubmissionsTable)
        .where(whereClause)
        .orderBy(desc(formSubmissionsTable.createdAt))
        .limit(limit + 1),
      db
        .select({ deviceType: formViewsTable.deviceType, value: count() })
        .from(formViewsTable)
        .where(eq(formViewsTable.formId, formId))
        .groupBy(formViewsTable.deviceType),
    ]);

    const hasMore = pageRows.length > limit;
    const submissions = hasMore ? pageRows.slice(0, limit) : pageRows;
    const nextCursor = hasMore
      ? submissions[submissions.length - 1]!.createdAt.toISOString()
      : null;

    const deviceMap = { desktop: 0, mobile: 0, tablet: 0 };
    let viewsCount = 0;
    deviceRows.forEach((r) => {
      const n = Number(r.value);
      viewsCount += n;
      const dev = r.deviceType.toLowerCase();
      if (dev.includes("mobile")) deviceMap.mobile += n;
      else if (dev.includes("tablet")) deviceMap.tablet += n;
      else deviceMap.desktop += n;
    });

    const deviceViews = Object.entries(deviceMap).map(([device, cnt]) => ({
      device,
      count: cnt,
    }));

    return { submissions, nextCursor, viewsCount, deviceViews };
  }

  public async recordView(payload: RecordViewInputType) {
    const { formId, deviceType } = await recordViewInput.parseAsync(payload);

    await db.insert(formViewsTable).values({
      formId,
      deviceType,
    });

    return { success: true };
  }
}

export default FormSubmissionService;
