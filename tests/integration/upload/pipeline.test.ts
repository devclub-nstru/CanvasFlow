import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestForm } from "../helpers/factories";

/* The upload pipeline, across the two processes that actually run it.
 *
 * apps/api accepts the file and enqueues a job; apps/worker consumes that job
 * and hands the file to storage. Both ends have unit coverage with the other
 * end faked, which means nothing yet proves they agree on the job payload — a
 * renamed field in ProcessUploadJob would pass every existing test and silently
 * strand every upload in "pending".
 *
 * Real Postgres, real Redis, a real BullMQ queue and a real worker. Only the
 * storage adapter is a fake: reaching Cloudinary from a test suite would make
 * it slow, flaky and dependent on someone's credentials. */

const TMP_DIR = path.join(os.tmpdir(), `canvasflow-upload-tests-${process.pid}`);
fs.mkdirSync(TMP_DIR, { recursive: true });
process.env.UPLOAD_TMP_DIR = TMP_DIR;

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("@repo/logger", () => ({ logger, default: logger }));

/* Dynamic imports, deliberately: apps/api/src/routes/upload.ts reads
 * UPLOAD_TMP_DIR and creates the directory at module load, so it must not be
 * imported before the assignment above. */
const { eq } = await import("@repo/database");
const { formUploadsTable } = await import("@repo/database/models/form-upload");
const { uploadsQueue, createUploadWorker, drainProducers } = await import("@repo/queue");
const { db, resetDatabase, teardownDatabase } = await import("../helpers/db");
const { closeRedis, resetRedis } = await import("../helpers/redis");
const { makeField, makeForm, makeUser } = await import("../helpers/factories");
const { uploadRouter, uploadErrorHandler } = await import("../../../apps/api/src/routes/upload");
const { createUploadProcessor } = await import("../../../apps/worker/src/processors/upload");

/* Declared rather than indexed: with noUncheckedIndexedAccess a
 * Record<string, string> makes every field `string | undefined`, which then
 * fights every query built from it. */
interface UploadBody {
  uploadId: string;
  claimToken: string;
  status: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  error: string;
}

interface Uploaded {
  status: number;
  body: UploadBody;
}

let server: Server;
let base: string;
let worker: Awaited<ReturnType<typeof createUploadWorker>> | null = null;

/** Whatever the fake storage was asked to store, in call order. */
const stored: Array<{ localPath: string; formId: string; uploadId: string; originalName: string; mimeType: string }> = [];
let storageBehaviour: () => unknown = () => ({
  publicId: "cf/test/upload",
  url: "https://res.cloudinary.com/demo/raw/upload/v1/file",
  resourceType: "raw",
});

const fakeStorage = {
  upload: async (input: (typeof stored)[number]) => {
    stored.push(input);
    return storageBehaviour() as never;
  },
};

async function startApi() {
  const express = (await import("express")).default;
  const app = express();
  app.set("trust proxy", 1);
  app.use(uploadRouter);
  app.use(uploadErrorHandler);

  const listening: Server = app.listen(0);
  await new Promise((resolve) => listening.once("listening", resolve));
  return listening;
}

async function postFile(
  form: TestForm,
  fieldId: string,
  file: { name: string; type: string; bytes?: number },
): Promise<Uploaded> {
  const body = new FormData();
  body.append(
    "file",
    new Blob([new Uint8Array(file.bytes ?? 16).fill(65)], { type: file.type }),
    file.name,
  );

  const response = await fetch(`${base}/uploads/${form.id}/${fieldId}`, {
    method: "POST",
    body,
  });

  return { status: response.status, body: (await response.json().catch(() => ({}))) as never };
}

async function readStatus(uploadId: string, token: string): Promise<Uploaded> {
  const response = await fetch(`${base}/uploads/${uploadId}`, {
    headers: { "x-upload-token": token },
  });
  return { status: response.status, body: (await response.json().catch(() => ({}))) as never };
}

/** Waits for the worker to move the row out of pending/processing. */
async function waitForTerminalStatus(uploadId: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const [row] = await db
      .select()
      .from(formUploadsTable)
      .where(eq(formUploadsTable.id, uploadId));

    if (row && (row.status === "ready" || row.status === "failed")) return row;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`upload ${uploadId} never left pending — did the worker pick the job up?`);
}

async function uploadFieldOn(
  options: Parameters<typeof makeForm>[1] = {},
  fieldOptions: unknown = null,
) {
  const owner = await makeUser();
  const form = await makeForm(owner, { isPublished: true, ...options });
  const field = await makeField(form, {
    label: "Attach a file",
    type: "FILE_UPLOAD",
    options: fieldOptions,
  });
  return { owner, form, fieldId: field.id };
}

beforeAll(async () => {
  server = await startApi();
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (worker) await worker.close();
  await drainProducers();
  await new Promise((resolve) => server.close(() => resolve(null)));
  await closeRedis();
  await teardownDatabase();
  await fsp.rm(TMP_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  stored.length = 0;
  storageBehaviour = () => ({
    publicId: "cf/test/upload",
    url: "https://res.cloudinary.com/demo/raw/upload/v1/file",
    resourceType: "raw",
  });
});

/* ─── Accepting the file ───────────────────────────────────────────────── */

describe("POST /uploads/:formId/:fieldId", () => {
  it("accepts a file and records it as pending", async () => {
    const { form, fieldId } = await uploadFieldOn();

    const result = await postFile(form, fieldId, { name: "notes.txt", type: "text/plain" });

    expect(result.status).toBe(202);
    expect(result.body.uploadId).toBeTruthy();
    expect(result.body.claimToken).toBeTruthy();

    const [row] = await db
      .select()
      .from(formUploadsTable)
      .where(eq(formUploadsTable.id, result.body.uploadId));

    expect(row?.status).toBe("pending");
    expect(row?.formId).toBe(form.id);
    expect(row?.originalName).toBe("notes.txt");
  });

  it("writes the file to the temp directory and records where", async () => {
    const { form, fieldId } = await uploadFieldOn();
    const result = await postFile(form, fieldId, { name: "notes.txt", type: "text/plain" });

    const [row] = await db
      .select()
      .from(formUploadsTable)
      .where(eq(formUploadsTable.id, result.body.uploadId));

    expect(row?.storedPath).toContain(TMP_DIR);
    expect(fs.existsSync(row!.storedPath!)).toBe(true);
  });

  it("puts a job on the queue the worker is listening to", async () => {
    const { form, fieldId } = await uploadFieldOn();
    const result = await postFile(form, fieldId, { name: "notes.txt", type: "text/plain" });

    const job = await uploadsQueue().getJob(result.body.uploadId);

    expect(job, "the job id is the upload id").not.toBeNull();
    expect(job?.data).toMatchObject({
      uploadId: result.body.uploadId,
      formId: form.id,
      originalName: "notes.txt",
      mimeType: "text/plain",
    });
    expect(job?.data.storedPath).toContain(TMP_DIR);
  });

  it("refuses a question that is not a file upload", async () => {
    const owner = await makeUser();
    const form = await makeForm(owner, { isPublished: true });
    const field = await makeField(form, { label: "Your name", type: "TEXT" });

    const result = await postFile(form, field.id, { name: "notes.txt", type: "text/plain" });

    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/does not accept file uploads/i);
  });

  it("refuses an unpublished form", async () => {
    const { form, fieldId } = await uploadFieldOn({ isPublished: false });
    const result = await postFile(form, fieldId, { name: "notes.txt", type: "text/plain" });

    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/not published/i);
  });

  it("refuses a closed form", async () => {
    const { form, fieldId } = await uploadFieldOn({ isOpen: false });
    const result = await postFile(form, fieldId, { name: "notes.txt", type: "text/plain" });

    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/closed/i);
  });

  it("answers 404 for a question that does not exist", async () => {
    const { form } = await uploadFieldOn();
    const result = await postFile(form, "00000000-0000-4000-8000-000000000000", {
      name: "notes.txt",
      type: "text/plain",
    });

    expect(result.status).toBe(404);
  });

  it("refuses a content type that is not on the allow-list", async () => {
    const { form, fieldId } = await uploadFieldOn();
    const result = await postFile(form, fieldId, {
      name: "payload.sh",
      type: "application/x-sh",
    });

    expect(result.status).toBe(415);
    expect(await db.select().from(formUploadsTable)).toHaveLength(0);
  });

  it("refuses a type the question itself does not accept", async () => {
    const { form, fieldId } = await uploadFieldOn({}, { accept: ["image/*"] });

    const rejected = await postFile(form, fieldId, { name: "notes.txt", type: "text/plain" });
    expect(rejected.status).toBe(415);

    const accepted = await postFile(form, fieldId, { name: "photo.png", type: "image/png" });
    expect(accepted.status).toBe(202);
  });

  it("refuses a file over the question's own size limit", async () => {
    const { form, fieldId } = await uploadFieldOn({}, { maxMb: 1 });

    const result = await postFile(form, fieldId, {
      name: "big.txt",
      type: "text/plain",
      bytes: 2 * 1024 * 1024,
    });

    expect(result.status).toBe(413);
    expect(result.body.error).toMatch(/over the 1MB limit/i);
  });

  it("leaves no temp file behind when it refuses on size", async () => {
    const { form, fieldId } = await uploadFieldOn({}, { maxMb: 1 });

    /* Earlier tests leave pending files here on purpose — the worker only runs
     * in the block below — so compare against the directory as it stands
     * rather than expecting it to be empty. */
    const before = fs.readdirSync(TMP_DIR);

    await postFile(form, fieldId, {
      name: "big.txt",
      type: "text/plain",
      bytes: 2 * 1024 * 1024,
    });

    expect(await db.select().from(formUploadsTable)).toHaveLength(0);
    expect(fs.readdirSync(TMP_DIR).sort()).toEqual(before.sort());
  });
});

/* ─── Reading the status ───────────────────────────────────────────────── */

describe("GET /uploads/:uploadId", () => {
  it("reports the status to whoever holds the claim token", async () => {
    const { form, fieldId } = await uploadFieldOn();
    const uploaded = await postFile(form, fieldId, { name: "notes.txt", type: "text/plain" });

    const status = await readStatus(uploaded.body.uploadId, uploaded.body.claimToken);

    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      uploadId: uploaded.body.uploadId,
      status: "pending",
      name: "notes.txt",
    });
  });

  it("refuses a request with no token at all", async () => {
    const { form, fieldId } = await uploadFieldOn();
    const uploaded = await postFile(form, fieldId, { name: "notes.txt", type: "text/plain" });

    const response = await fetch(`${base}/uploads/${uploaded.body.uploadId}`);
    expect(response.status).toBe(401);
  });

  it("refuses the wrong claim token, and says nothing about the upload", async () => {
    const { form, fieldId } = await uploadFieldOn();
    const uploaded = await postFile(form, fieldId, { name: "notes.txt", type: "text/plain" });

    const status = await readStatus(uploaded.body.uploadId, "not-the-right-token");

    expect(status.status).toBe(404);
    expect(JSON.stringify(status.body)).not.toContain("notes.txt");
  });

  it("refuses another upload's claim token", async () => {
    const { form, fieldId } = await uploadFieldOn();
    const mine = await postFile(form, fieldId, { name: "mine.txt", type: "text/plain" });
    const theirs = await postFile(form, fieldId, { name: "theirs.txt", type: "text/plain" });

    const status = await readStatus(mine.body.uploadId, theirs.body.claimToken);
    expect(status.status).toBe(404);
  });

  it("answers 404 for an upload that does not exist", async () => {
    const status = await readStatus("00000000-0000-4000-8000-000000000000", "any-token");
    expect(status.status).toBe(404);
  });
});

/* ─── The handoff to the worker ────────────────────────────────────────── */

describe("the worker consuming the queue", () => {
  beforeAll(() => {
    /* One worker for this block, consuming the same queue apps/api produces
     * to — the seam these tests exist for. */
    worker = createUploadWorker(createUploadProcessor(fakeStorage));
  });

  it("picks the job up and stores the file", async () => {
    const { form, fieldId } = await uploadFieldOn();
    const uploaded = await postFile(form, fieldId, { name: "report.pdf", type: "application/pdf" });

    const row = await waitForTerminalStatus(uploaded.body.uploadId);

    expect(row.status).toBe("ready");
    expect(row.cloudinaryUrl).toBe("https://res.cloudinary.com/demo/raw/upload/v1/file");
    expect(row.cloudinaryPublicId).toBe("cf/test/upload");
  });

  it("hands storage exactly what apps/api enqueued", async () => {
    const { form, fieldId } = await uploadFieldOn();
    const uploaded = await postFile(form, fieldId, { name: "report.pdf", type: "application/pdf" });

    await waitForTerminalStatus(uploaded.body.uploadId);

    expect(stored[0]).toMatchObject({
      uploadId: uploaded.body.uploadId,
      formId: form.id,
      originalName: "report.pdf",
      mimeType: "application/pdf",
    });
    expect(stored[0]?.localPath, "the path the API wrote is the path the worker reads").toContain(
      TMP_DIR,
    );
  });

  it("deletes the temp file once it is stored", async () => {
    const { form, fieldId } = await uploadFieldOn();
    const uploaded = await postFile(form, fieldId, { name: "report.pdf", type: "application/pdf" });

    const localPath = stored.length > 0 ? stored[0]?.localPath : undefined;
    await waitForTerminalStatus(uploaded.body.uploadId);

    const finalPath = localPath ?? stored[0]?.localPath;
    expect(finalPath).toBeTruthy();
    expect(fs.existsSync(finalPath!)).toBe(false);
  });

  it("makes the result visible through the status endpoint the browser polls", async () => {
    const { form, fieldId } = await uploadFieldOn();
    const uploaded = await postFile(form, fieldId, { name: "report.pdf", type: "application/pdf" });

    await waitForTerminalStatus(uploaded.body.uploadId);
    const status = await readStatus(uploaded.body.uploadId, uploaded.body.claimToken);

    expect(status.body).toMatchObject({
      status: "ready",
      url: "https://res.cloudinary.com/demo/raw/upload/v1/file",
      error: null,
    });
  });

  it("records a permanent storage failure against the upload", async () => {
    const { PermanentStorageError } = await import("../../../apps/worker/src/storage");
    storageBehaviour = () => {
      throw new PermanentStorageError("file type is not allowed");
    };

    const { form, fieldId } = await uploadFieldOn();
    const uploaded = await postFile(form, fieldId, { name: "report.pdf", type: "application/pdf" });

    const row = await waitForTerminalStatus(uploaded.body.uploadId);

    expect(row.status).toBe("failed");
    expect(row.error).toBe("file type is not allowed");
  });

  it("shows that failure to the browser, rather than leaving it polling forever", async () => {
    const { PermanentStorageError } = await import("../../../apps/worker/src/storage");
    storageBehaviour = () => {
      throw new PermanentStorageError("unsupported format");
    };

    const { form, fieldId } = await uploadFieldOn();
    const uploaded = await postFile(form, fieldId, { name: "report.pdf", type: "application/pdf" });

    await waitForTerminalStatus(uploaded.body.uploadId);
    const status = await readStatus(uploaded.body.uploadId, uploaded.body.claimToken);

    expect(status.body).toMatchObject({ status: "failed", error: "unsupported format" });
  });

  it("recovers when storage fails once and then succeeds", async () => {
    let attempts = 0;
    storageBehaviour = () => {
      attempts += 1;
      if (attempts === 1) throw new Error("socket hang up");
      return {
        publicId: "cf/test/retried",
        url: "https://res.cloudinary.com/demo/raw/upload/v1/retried",
        resourceType: "raw",
      };
    };

    const { form, fieldId } = await uploadFieldOn();
    const uploaded = await postFile(form, fieldId, { name: "report.pdf", type: "application/pdf" });

    const row = await waitForTerminalStatus(uploaded.body.uploadId, 30_000);

    expect(attempts, "BullMQ retried a transient failure").toBeGreaterThan(1);
    expect(row.status).toBe("ready");
    expect(row.cloudinaryPublicId).toBe("cf/test/retried");
  });
});
