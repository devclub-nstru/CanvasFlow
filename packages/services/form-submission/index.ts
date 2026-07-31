import { db, eq, and, desc, gte, lt, count, usersTable } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import {
  submitFormInput,
  type SubmitFormInputType,
  getSubmissionsInput,
  type GetSubmissionsInputType,
} from "./model";

// Sentinel error message the client looks for to render the
// "already submitted" screen instead of a generic toast. Keep this
// string stable — the public form page matches against it.
export const ALREADY_SUBMITTED_ERROR = "ALREADY_SUBMITTED";

// Same contract, for "this form can't take any more responses". Raised both
// when the form hits its own maxSubmissions cap and when the owner's monthly
// plan quota is exhausted: to the person filling the form in, those are the
// same dead end, and the plan case must not report the owner's tier or quota
// to a stranger on a public page.
export const LIMIT_REACHED_ERROR = "LIMIT_REACHED";

class FormSubmissionService {
  public async submitForm(payload: SubmitFormInputType) {
    const {
      formId,
      values,
      idempotencyKey,
      visitorId,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      timeSpentMs,
      deviceType,
    } = await submitFormInput.parseAsync(payload);

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
        throw new Error(LIMIT_REACHED_ERROR);
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
      // Deliberately the same opaque sentinel as the per-form cap. This used
      // to throw the tier name and the quota number, which surfaced in a
      // toast on a public form — telling any respondent which plan the owner
      // is on. The owner sees the real reason in their dashboard.
      throw new Error(LIMIT_REACHED_ERROR);
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
          referrer: referrer ?? null,
          utmSource: utmSource ?? null,
          utmMedium: utmMedium ?? null,
          utmCampaign: utmCampaign ?? null,
          timeSpentMs: timeSpentMs ?? null,
          deviceType: deviceType ?? null,
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
    const pageRows = await db
      .select()
      .from(formSubmissionsTable)
      .where(whereClause)
      .orderBy(desc(formSubmissionsTable.createdAt))
      .limit(limit + 1);

    const hasMore = pageRows.length > limit;
    const submissions = hasMore ? pageRows.slice(0, limit) : pageRows;
    const nextCursor = hasMore
      ? submissions[submissions.length - 1]!.createdAt.toISOString()
      : null;

    return { submissions, nextCursor };
  }
}

export default FormSubmissionService;
