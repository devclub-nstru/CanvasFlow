import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* The processor decides which failures are permanent and which BullMQ should
 * retry. Getting that wrong either discards a respondent's file or retries a
 * hopeless job until the queue is full, and neither is visible from the
 * storage adapter or the service on its own.
 *
 * `createUploadProcessor` takes its storage as an argument, so the adapter is a
 * plain fake. Only the service and the filesystem need mocking. */

const formUploadService = {
  markProcessing: vi.fn(),
  markReady: vi.fn(),
  markFailed: vi.fn(),
};
vi.mock("../src/services", () => ({ formUploadService }));

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("@repo/logger", () => ({ logger, default: logger }));

const unlink = vi.fn();
vi.mock("node:fs/promises", () => ({ default: { unlink }, unlink }));

const { createUploadProcessor } = await import("../src/processors/upload");
const { PermanentStorageError, StorageNotConfiguredError } = await import("../src/storage");

const UPLOAD_ID = "upload-1";

const claimableRow = (overrides: Record<string, unknown> = {}) => ({
  formId: "form-1",
  storedPath: "/tmp/uploads/upload-1.bin",
  originalName: "report.pdf",
  mimeType: "application/pdf",
  ...overrides,
});

const storedFile = {
  publicId: "canvasflow/form-1/upload-1",
  url: "https://res.cloudinary.com/demo/raw/upload/v1/report.pdf",
  resourceType: "raw",
};

function job(overrides: Partial<Job> = {}): Job {
  return {
    data: { uploadId: UPLOAD_ID },
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...overrides,
  } as unknown as Job;
}

/** A storage adapter that does whatever the test tells it to. */
function storageThat(behaviour: () => unknown) {
  return { upload: vi.fn(async () => behaviour() as never) };
}

beforeEach(() => {
  vi.clearAllMocks();
  formUploadService.markProcessing.mockResolvedValue(claimableRow());
  unlink.mockResolvedValue(undefined);
});

/* ─── Claiming ─────────────────────────────────────────────────────────── */

describe("claiming the job", () => {
  it("stops quietly when the upload is no longer claimable", async () => {
    formUploadService.markProcessing.mockResolvedValue(null);
    const storage = storageThat(() => storedFile);

    await createUploadProcessor(storage)(job());

    expect(storage.upload).not.toHaveBeenCalled();
    expect(formUploadService.markFailed).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("no longer claimable"));
  });

  it("does not throw on an unclaimable job, so BullMQ does not retry it", async () => {
    formUploadService.markProcessing.mockResolvedValue(null);
    await expect(createUploadProcessor(storageThat(() => storedFile))(job())).resolves.toBeUndefined();
  });

  it("fails the upload when the temporary file path was lost", async () => {
    formUploadService.markProcessing.mockResolvedValue(claimableRow({ storedPath: null }));
    const storage = storageThat(() => storedFile);

    await createUploadProcessor(storage)(job());

    expect(storage.upload).not.toHaveBeenCalled();
    expect(formUploadService.markFailed).toHaveBeenCalledWith({
      uploadId: UPLOAD_ID,
      error: "Temporary file path is missing",
    });
  });

  it("does not retry a job with no file to upload", async () => {
    formUploadService.markProcessing.mockResolvedValue(claimableRow({ storedPath: "" }));
    await expect(
      createUploadProcessor(storageThat(() => storedFile))(job()),
    ).resolves.toBeUndefined();
  });
});

/* ─── The happy path ───────────────────────────────────────────────────── */

describe("a successful upload", () => {
  it("hands the storage adapter everything it needs", async () => {
    const storage = storageThat(() => storedFile);
    await createUploadProcessor(storage)(job());

    expect(storage.upload).toHaveBeenCalledWith({
      localPath: "/tmp/uploads/upload-1.bin",
      formId: "form-1",
      uploadId: UPLOAD_ID,
      originalName: "report.pdf",
      mimeType: "application/pdf",
    });
  });

  it("records where the file ended up", async () => {
    await createUploadProcessor(storageThat(() => storedFile))(job());

    expect(formUploadService.markReady).toHaveBeenCalledWith({
      uploadId: UPLOAD_ID,
      cloudinaryPublicId: storedFile.publicId,
      cloudinaryUrl: storedFile.url,
      cloudinaryResourceType: storedFile.resourceType,
    });
  });

  it("deletes the temporary file afterwards", async () => {
    await createUploadProcessor(storageThat(() => storedFile))(job());
    expect(unlink).toHaveBeenCalledWith("/tmp/uploads/upload-1.bin");
  });

  it("marks the upload ready before unlinking, never the other way round", async () => {
    await createUploadProcessor(storageThat(() => storedFile))(job());

    const readyAt = formUploadService.markReady.mock.invocationCallOrder[0]!;
    const unlinkAt = unlink.mock.invocationCallOrder[0]!;
    expect(readyAt).toBeLessThan(unlinkAt);
  });

  it("still counts as a success when the temporary file cannot be deleted", async () => {
    unlink.mockRejectedValue(new Error("EBUSY"));

    await expect(
      createUploadProcessor(storageThat(() => storedFile))(job()),
    ).resolves.toBeUndefined();
    expect(formUploadService.markFailed).not.toHaveBeenCalled();
  });
});

/* ─── Permanent failures ───────────────────────────────────────────────── */

describe("a permanent failure", () => {
  it("is recorded and swallowed, so BullMQ does not retry it", async () => {
    const storage = storageThat(() => {
      throw new PermanentStorageError("file type is not allowed");
    });

    await expect(createUploadProcessor(storage)(job())).resolves.toBeUndefined();
    expect(formUploadService.markFailed).toHaveBeenCalledWith({
      uploadId: UPLOAD_ID,
      error: "file type is not allowed",
    });
  });

  it("treats a missing storage configuration as permanent", async () => {
    const storage = storageThat(() => {
      throw new StorageNotConfiguredError();
    });

    await expect(createUploadProcessor(storage)(job())).resolves.toBeUndefined();
    expect(formUploadService.markFailed).toHaveBeenCalledWith({
      uploadId: UPLOAD_ID,
      error: expect.stringContaining("Cloudinary is not configured"),
    });
  });

  it("fails on the first attempt rather than burning the retry budget", async () => {
    const storage = storageThat(() => {
      throw new PermanentStorageError("unsupported format");
    });

    await createUploadProcessor(storage)(job({ attemptsMade: 0, opts: { attempts: 5 } } as Partial<Job>));
    expect(formUploadService.markFailed).toHaveBeenCalledOnce();
  });

  it("is logged at error level", async () => {
    const storage = storageThat(() => {
      throw new PermanentStorageError("nope");
    });

    await createUploadProcessor(storage)(job());
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("permanently failed"));
  });

  it("leaves the temporary file alone for a failed upload", async () => {
    const storage = storageThat(() => {
      throw new PermanentStorageError("nope");
    });

    await createUploadProcessor(storage)(job());
    expect(unlink).not.toHaveBeenCalled();
  });
});

/* ─── Transient failures ───────────────────────────────────────────────── */

describe("a transient failure", () => {
  const flaky = () =>
    storageThat(() => {
      throw new Error("socket hang up");
    });

  it("rethrows so BullMQ retries the job", async () => {
    await expect(createUploadProcessor(flaky())(job({ attemptsMade: 0 } as Partial<Job>))).rejects.toThrow(
      "socket hang up",
    );
  });

  it("does not mark the upload failed while attempts remain", async () => {
    await createUploadProcessor(flaky())(job({ attemptsMade: 0, opts: { attempts: 3 } } as Partial<Job>)).catch(
      () => {},
    );
    expect(formUploadService.markFailed).not.toHaveBeenCalled();
  });

  it("marks the upload failed on the final attempt", async () => {
    /* attemptsMade is the count *before* this run, so 2 of 3 is the last one. */
    await createUploadProcessor(flaky())(job({ attemptsMade: 2, opts: { attempts: 3 } } as Partial<Job>)).catch(
      () => {},
    );
    expect(formUploadService.markFailed).toHaveBeenCalledWith({
      uploadId: UPLOAD_ID,
      error: "socket hang up",
    });
  });

  it("still rethrows on the final attempt, so the job lands in the failed set", async () => {
    await expect(
      createUploadProcessor(flaky())(job({ attemptsMade: 2, opts: { attempts: 3 } } as Partial<Job>)),
    ).rejects.toThrow("socket hang up");
  });

  it("treats a job with no configured attempts as single-shot", async () => {
    await createUploadProcessor(flaky())(job({ attemptsMade: 0, opts: {} } as Partial<Job>)).catch(() => {});
    expect(formUploadService.markFailed).toHaveBeenCalled();
  });

  it("logs which attempt failed, and out of how many", async () => {
    await createUploadProcessor(flaky())(job({ attemptsMade: 1, opts: { attempts: 3 } } as Partial<Job>)).catch(
      () => {},
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("attempt 2/3"));
  });

  it("copes with a thrown value that is not an Error", async () => {
    const storage = storageThat(() => {
      throw "just a string";
    });

    await createUploadProcessor(storage)(job({ attemptsMade: 0, opts: { attempts: 1 } } as Partial<Job>)).catch(
      () => {},
    );
    expect(formUploadService.markFailed).toHaveBeenCalledWith({
      uploadId: UPLOAD_ID,
      error: "Upload failed",
    });
  });
});
