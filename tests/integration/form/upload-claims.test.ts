import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "@repo/database";
import { formUploadsTable } from "@repo/database/models/form-upload";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { formUploadService } from "@repo/trpc/server/services";
import { db, resetDatabase, teardownDatabase } from "../helpers/db";
import { closeRedis, resetRedis } from "../helpers/redis";
import { anonymousCaller, expectRejection } from "../helpers/caller";
import { makeField, makeForm, makeUser, type TestForm, type TestUser } from "../helpers/factories";

/* Attaching uploaded files to the submission that references them.
 *
 * `submitForm` calls claimUploadsForSubmission for every FILE_UPLOAD answer,
 * which decides — from a claim token the browser supplies — whether a given
 * upload belongs to this submission, and then rewrites the stored answer to
 * the file's real details. Two things make it worth testing against real rows:
 * it is the authorisation boundary for files, and it mutates the answer that
 * ends up in the responses table.
 *
 * Nothing else in the suite exercises it: the submissions tests deliberately
 * use text questions. */

let owner: TestUser;

interface PendingUpload {
  uploadId: string;
  claimToken: string;
}

async function uploadForm(): Promise<{ form: TestForm; fileFieldId: string; textFieldId: string }> {
  const form = await makeForm(owner, { isPublished: true });
  const file = await makeField(form, { label: "Attach something", type: "FILE_UPLOAD" });
  const text = await makeField(form, { label: "Anything else?", type: "TEXTAREA" });
  return { form, fileFieldId: file.id, textFieldId: text.id };
}

async function pendingUpload(
  form: TestForm,
  fieldId: string,
  overrides: Partial<{ originalName: string; mimeType: string; sizeBytes: number }> = {},
): Promise<PendingUpload> {
  const created = await formUploadService.createPendingUpload({
    formId: form.id,
    formFieldId: fieldId,
    originalName: overrides.originalName ?? "report.pdf",
    mimeType: overrides.mimeType ?? "application/pdf",
    sizeBytes: overrides.sizeBytes ?? 1024,
    storedPath: `/tmp/canvasflow/${crypto.randomUUID()}`,
  });

  return { uploadId: created.uploadId, claimToken: created.claimToken };
}

/** Marks an upload as stored, the way the worker would. */
async function markReady(uploadId: string, url = "https://cdn.test/report.pdf"): Promise<void> {
  await formUploadService.markReady({
    uploadId,
    cloudinaryPublicId: "cf/test/report",
    cloudinaryUrl: url,
    cloudinaryResourceType: "raw",
  });
}

async function submitWith(form: TestForm, fieldId: string, value: unknown) {
  return anonymousCaller().form.submitForm({
    formId: form.id,
    values: [{ formFieldId: fieldId, value }],
  });
}

/** The stored answer for one field, read back out of the submission row. */
async function storedValue(submissionId: string, fieldId: string): Promise<unknown> {
  const [row] = await db
    .select()
    .from(formSubmissionsTable)
    .where(eq(formSubmissionsTable.id, submissionId));

  const values = row?.values as Array<{ formFieldId: string; value: unknown }>;
  return values.find((entry) => entry.formFieldId === fieldId)?.value;
}

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  owner = await makeUser({ name: "Owner" });
});

afterAll(async () => {
  await closeRedis();
  await teardownDatabase();
});

/* ─── The happy path ───────────────────────────────────────────────────── */

describe("a submission carrying an upload", () => {
  it("attaches the upload to itself", async () => {
    const { form, fileFieldId } = await uploadForm();
    const upload = await pendingUpload(form, fileFieldId);
    await markReady(upload.uploadId);

    const { id } = await submitWith(form, fileFieldId, [upload]);

    const [row] = await db
      .select()
      .from(formUploadsTable)
      .where(eq(formUploadsTable.id, upload.uploadId));
    expect(row?.submissionId).toBe(id);
  });

  it("rewrites the answer to the file's real details", async () => {
    const { form, fileFieldId } = await uploadForm();
    const upload = await pendingUpload(form, fileFieldId, {
      originalName: "q4-results.pdf",
      sizeBytes: 4096,
    });
    await markReady(upload.uploadId, "https://cdn.test/q4-results.pdf");

    const { id } = await submitWith(form, fileFieldId, [upload]);

    expect(await storedValue(id, fileFieldId)).toEqual([
      {
        uploadId: upload.uploadId,
        name: "q4-results.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4096,
        url: "https://cdn.test/q4-results.pdf",
        status: "ready",
      },
    ]);
  });

  it("never stores the claim token in the response", async () => {
    const { form, fileFieldId } = await uploadForm();
    const upload = await pendingUpload(form, fileFieldId);
    await markReady(upload.uploadId);

    const { id } = await submitWith(form, fileFieldId, [upload]);

    expect(JSON.stringify(await storedValue(id, fileFieldId))).not.toContain(upload.claimToken);
  });

  it("accepts several files on one question", async () => {
    const { form, fileFieldId } = await uploadForm();
    const first = await pendingUpload(form, fileFieldId, { originalName: "one.pdf" });
    const second = await pendingUpload(form, fileFieldId, { originalName: "two.pdf" });
    await markReady(first.uploadId);
    await markReady(second.uploadId);

    const { id } = await submitWith(form, fileFieldId, [first, second]);

    const value = (await storedValue(id, fileFieldId)) as Array<{ name: string }>;
    expect(value.map((entry) => entry.name).sort()).toEqual(["one.pdf", "two.pdf"]);
  });

  it("accepts a single reference that is not wrapped in an array", async () => {
    const { form, fileFieldId } = await uploadForm();
    const upload = await pendingUpload(form, fileFieldId);
    await markReady(upload.uploadId);

    const { id } = await submitWith(form, fileFieldId, upload);

    const value = (await storedValue(id, fileFieldId)) as Array<{ uploadId: string }>;
    expect(value[0]?.uploadId).toBe(upload.uploadId);
  });

  it("leaves answers to other questions alone", async () => {
    const { form, fileFieldId, textFieldId } = await uploadForm();
    const upload = await pendingUpload(form, fileFieldId);
    await markReady(upload.uploadId);

    const { id } = await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [
        { formFieldId: fileFieldId, value: [upload] },
        { formFieldId: textFieldId, value: "just some text" },
      ],
    });

    expect(await storedValue(id, textFieldId)).toBe("just some text");
  });

  it("carries a still-processing upload through with its status", async () => {
    /* The claim does not require `ready`: the answer records the status so the
     * respondent's page can keep polling after the form is submitted. */
    const { form, fileFieldId } = await uploadForm();
    const upload = await pendingUpload(form, fileFieldId);

    const { id } = await submitWith(form, fileFieldId, [upload]);

    const value = (await storedValue(id, fileFieldId)) as Array<{
      status: string;
      url: string | null;
    }>;
    expect(value[0]?.status).toBe("pending");
    expect(value[0]?.url).toBeNull();
  });
});

/* ─── What it refuses to claim ─────────────────────────────────────────── */

describe("an upload that is not this submission's to claim", () => {
  it("is ignored when the claim token is wrong", async () => {
    const { form, fileFieldId } = await uploadForm();
    const upload = await pendingUpload(form, fileFieldId);
    await markReady(upload.uploadId);

    const { id } = await submitWith(form, fileFieldId, [
      { uploadId: upload.uploadId, claimToken: "not-the-right-token" },
    ]);

    expect(await storedValue(id, fileFieldId)).toEqual([]);

    const [row] = await db
      .select()
      .from(formUploadsTable)
      .where(eq(formUploadsTable.id, upload.uploadId));
    expect(row?.submissionId, "and stays unattached").toBeNull();
  });

  it("is ignored when it belongs to another form", async () => {
    const mine = await uploadForm();
    const theirs = await uploadForm();
    const upload = await pendingUpload(theirs.form, theirs.fileFieldId);
    await markReady(upload.uploadId);

    const { id } = await submitWith(mine.form, mine.fileFieldId, [upload]);

    expect(await storedValue(id, mine.fileFieldId)).toEqual([]);
  });

  it("is ignored when it belongs to another question on the same form", async () => {
    const form = await makeForm(owner, { isPublished: true });
    const first = await makeField(form, { label: "CV", type: "FILE_UPLOAD" });
    const second = await makeField(form, { label: "Cover letter", type: "FILE_UPLOAD" });

    const upload = await pendingUpload(form, second.id);
    await markReady(upload.uploadId);

    const { id } = await submitWith(form, first.id, [upload]);

    expect(await storedValue(id, first.id)).toEqual([]);
  });

  it("is ignored when it is already attached to a different submission", async () => {
    const { form, fileFieldId } = await uploadForm();
    const upload = await pendingUpload(form, fileFieldId);
    await markReady(upload.uploadId);

    const first = await submitWith(form, fileFieldId, [upload]);
    const second = await submitWith(form, fileFieldId, [upload]);

    expect(await storedValue(second.id, fileFieldId)).toEqual([]);

    const [row] = await db
      .select()
      .from(formUploadsTable)
      .where(eq(formUploadsTable.id, upload.uploadId));
    expect(row?.submissionId, "the first claim holds").toBe(first.id);
  });

  it("is ignored when it does not exist", async () => {
    const { form, fileFieldId } = await uploadForm();

    const { id } = await submitWith(form, fileFieldId, [
      { uploadId: "00000000-0000-4000-8000-000000000000", claimToken: "anything" },
    ]);

    expect(await storedValue(id, fileFieldId)).toEqual([]);
  });

  it("drops a reference that is the wrong shape entirely", async () => {
    const { form, fileFieldId } = await uploadForm();
    const upload = await pendingUpload(form, fileFieldId);
    await markReady(upload.uploadId);

    const { id } = await submitWith(form, fileFieldId, [
      { uploadId: "not-a-uuid", claimToken: "x" },
      { claimToken: "no upload id" },
      "a bare string",
      upload,
    ]);

    const value = (await storedValue(id, fileFieldId)) as Array<{ uploadId: string }>;
    expect(value.map((entry) => entry.uploadId)).toEqual([upload.uploadId]);
  });

  it("counts a repeated reference only once", async () => {
    const { form, fileFieldId } = await uploadForm();
    const upload = await pendingUpload(form, fileFieldId);
    await markReady(upload.uploadId);

    const { id } = await submitWith(form, fileFieldId, [upload, upload, upload]);

    expect((await storedValue(id, fileFieldId)) as unknown[]).toHaveLength(1);
  });

  it("still records the submission when every file is refused", async () => {
    const { form, fileFieldId } = await uploadForm();

    const { id } = await submitWith(form, fileFieldId, [
      { uploadId: "00000000-0000-4000-8000-000000000000", claimToken: "anything" },
    ]);

    const [row] = await db
      .select()
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.id, id));
    expect(row, "a bad file reference must not lose the whole response").toBeDefined();
  });
});

/* ─── Reading a claimed upload back ────────────────────────────────────── */

describe("after a claim", () => {
  it("the status endpoint still answers the original token holder", async () => {
    const { form, fileFieldId } = await uploadForm();
    const upload = await pendingUpload(form, fileFieldId);
    await markReady(upload.uploadId);
    await submitWith(form, fileFieldId, [upload]);

    const status = await formUploadService.getUploadStatus({
      uploadId: upload.uploadId,
      claimToken: upload.claimToken,
    });

    expect(status.status).toBe("ready");
  });

  it("a wrong token is still refused", async () => {
    const { form, fileFieldId } = await uploadForm();
    const upload = await pendingUpload(form, fileFieldId);
    await markReady(upload.uploadId);
    await submitWith(form, fileFieldId, [upload]);

    await expectRejection(
      formUploadService.getUploadStatus({
        uploadId: upload.uploadId,
        claimToken: "not-the-right-token",
      }),
    );
  });
});
