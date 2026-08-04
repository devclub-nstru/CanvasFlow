import { db, eq, and, desc, lt } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { getFormBundle, invalidateFormCount, requireViewer } from "../form";
import FormUploadService from "../form-upload";
import { assertRespondentAllowed, ALREADY_RESPONDED_ERROR, type Respondent } from "./access";
export * from "./access";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import {
  submitFormInput,
  type SubmitFormInputType,
  getSubmissionsInput,
  type GetSubmissionsInputType,
} from "./model";

export const ALREADY_SUBMITTED_ERROR = "ALREADY_SUBMITTED";

const formUploadService = new FormUploadService();

class FormSubmissionService {
  // Records form submission
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

    const bundle = await getFormBundle(formId);
    if (!bundle) {
      throw new Error("Form not found");
    }

    const form = bundle.form;
    if (form.isArchived) {
      throw new Error("Form is archived");
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

    const rules = {
      requireSignIn: form.requireSignIn,
      collectRespondentEmail: form.collectRespondentEmail,
      oneResponsePerRespondent: form.oneResponsePerRespondent,
      allowedEmailDomains: form.allowedEmailDomains,
    };

    assertRespondentAllowed(rules, respondent ?? null);

    const needsAccountCheck = form.oneResponsePerRespondent && !!respondent;
    const needsVisitorCheck = form.oneResponsePerRespondent && !form.requireSignIn && !!visitorId;

    if (needsAccountCheck || needsVisitorCheck) {
      const [priorByAccount, priorByVisitor] = await Promise.all([
        needsAccountCheck && respondent
          ? db
              .select({ id: formSubmissionsTable.id })
              .from(formSubmissionsTable)
              .where(
                and(
                  eq(formSubmissionsTable.formId, formId),
                  eq(formSubmissionsTable.respondentUserId, respondent.id),
                ),
              )
              .limit(1)
          : Promise.resolve([]),

        needsVisitorCheck && visitorId
          ? db
              .select({ id: formSubmissionsTable.id })
              .from(formSubmissionsTable)
              .where(
                and(
                  eq(formSubmissionsTable.formId, formId),
                  eq(formSubmissionsTable.visitorId, visitorId),
                ),
              )
              .limit(1)
          : Promise.resolve([]),
      ]);

      if (priorByAccount[0]) throw new Error(ALREADY_RESPONDED_ERROR);
      if (priorByVisitor[0]) throw new Error(ALREADY_SUBMITTED_ERROR);
    }

    const insertResult = await db
      .insert(formSubmissionsTable)
      .values({
        formId,
        values,
        idempotencyKey: idempotencyKey ?? null,
        visitorId: visitorId ?? null,
        respondentUserId: respondent?.id ?? null,
        respondentEmail: form.collectRespondentEmail ? (respondent?.email ?? null) : null,
        referrer: referrer ?? null,
        utmSource: utmSource ?? null,
        utmMedium: utmMedium ?? null,
        utmCampaign: utmCampaign ?? null,
        timeSpentMs: timeSpentMs ?? null,
        deviceType: deviceType ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: formSubmissionsTable.id });

    const inserted = insertResult[0];

    if (!inserted) {
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
        if (firstExisting) return { id: firstExisting.id };
      }

      throw new Error(ALREADY_SUBMITTED_ERROR);
    }

    const uploadFieldIds = new Set(
      bundle.fields.filter((field) => field.type === "FILE_UPLOAD").map((field) => field.id),
    );

    if (uploadFieldIds.size > 0) {
      const fileEntries = values.filter(
        (entry) =>
          uploadFieldIds.has(entry.formFieldId) &&
          entry.value !== null &&
          entry.value !== undefined,
      );

      if (fileEntries.length > 0) {
        const claimedPerField = await Promise.all(
          fileEntries.map(async (entry) => ({
            formFieldId: entry.formFieldId,
            files: await formUploadService.claimUploadsForSubmission({
              formId,
              formFieldId: entry.formFieldId,
              submissionId: inserted.id,
              refs: entry.value,
            }),
          })),
        );

        const rewritten = new Map(
          claimedPerField.map(({ formFieldId, files }) => [formFieldId, files]),
        );

        const normalisedValues = values.map((entry) =>
          rewritten.has(entry.formFieldId)
            ? { formFieldId: entry.formFieldId, value: rewritten.get(entry.formFieldId) }
            : entry,
        );

        await db
          .update(formSubmissionsTable)
          .set({ values: normalisedValues })
          .where(eq(formSubmissionsTable.id, inserted.id));
      }
    }

    await invalidateFormCount(formId);

    return {
      id: inserted.id,
    };
  }

  public async getSubmissions(payload: GetSubmissionsInputType) {
    const { formId, ownerId, cursor, limit } = await getSubmissionsInput.parseAsync(payload);

    await requireViewer(formId, ownerId);

    const cursorDate = cursor ? new Date(cursor) : null;
    const whereClause = cursorDate
      ? and(eq(formSubmissionsTable.formId, formId), lt(formSubmissionsTable.createdAt, cursorDate))
      : eq(formSubmissionsTable.formId, formId);

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
