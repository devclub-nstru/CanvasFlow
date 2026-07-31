import { db, eq, and, desc, lt } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import {
  assertRespondentAllowed,
  ALREADY_RESPONDED_ERROR,
  type Respondent,
} from "./access";
export * from "./access";
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

class FormSubmissionService {
  /**
   * Record a response.
   *
   * `respondent` is deliberately a separate argument rather than part of the
   * validated input: it comes from the session, and keeping it out of the Zod
   * schema makes it impossible for a request body to supply one.
   */
  public async submitForm(payload: SubmitFormInputType & { respondent?: Respondent | null }) {
    const { respondent } = payload;
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

    /* ── Who may respond ─────────────────────────────────────────────────
     *
     * `respondent` is resolved from the session by the tRPC layer, never from
     * the request body. That's the whole reason the domain restriction is worth
     * anything: an email the client could type is an email the client could
     * choose. */
    const rules = {
      requireSignIn: form.requireSignIn,
      collectRespondentEmail: form.collectRespondentEmail,
      oneResponsePerRespondent: form.oneResponsePerRespondent,
      allowedEmailDomains: form.allowedEmailDomains,
    };

    assertRespondentAllowed(rules, respondent ?? null);

    // One response per account, checked here rather than by a unique index:
    // the rule is a per-form setting and an index can't be conditional on a
    // column in another table. See the note on `form_submissions_form_respondent_idx`.
    if (form.oneResponsePerRespondent && respondent) {
      const prior = await db
        .select({ id: formSubmissionsTable.id })
        .from(formSubmissionsTable)
        .where(
          and(
            eq(formSubmissionsTable.formId, formId),
            eq(formSubmissionsTable.respondentUserId, respondent.id),
          ),
        )
        .limit(1);

      if (prior[0]) throw new Error(ALREADY_RESPONDED_ERROR);
    }

    // Legacy per-browser check, now conditional.
    //
    // This used to run unconditionally and was backed by a unique index, which
    // made every form one-response-per-browser whether the author wanted it or
    // not. It survives only as a courtesy for forms that ask for a single
    // response but don't require signing in — there it's the only signal
    // available. Visitors who can't write localStorage (private mode, storage
    // disabled) send a null visitorId and skip it — idempotency-key dedupe
    // still protects them from double-clicks within a page session.
    if (form.oneResponsePerRespondent && !form.requireSignIn && visitorId) {
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

    let insertResult;
    try {
      insertResult = await db
        .insert(formSubmissionsTable)
        .values({
          formId,
          values,
          idempotencyKey: idempotencyKey ?? null,
          visitorId: visitorId ?? null,
          // Always recorded when known, because it's what "one response per
          // respondent" is checked against on the next attempt. The email is
          // only kept when the author asked for it — identity and contact
          // details are separate decisions.
          respondentUserId: respondent?.id ?? null,
          respondentEmail: form.collectRespondentEmail ? (respondent?.email ?? null) : null,
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
