import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UPLOAD_STILL_PROCESSING,
  UploadError,
  fetchUploadStatus,
  startUpload,
  waitForUpload,
  type UploadedFileRef,
} from "~/lib/upload";

const ORIGIN = "http://localhost:8000";

/* ─── A stand-in for XMLHttpRequest ────────────────────────────────────── */

class FakeXHR {
  static last: FakeXHR | null = null;

  method = "";
  url = "";
  withCredentials = false;
  status = 0;
  responseText = "";
  sent: unknown = null;
  aborted = false;

  upload: { onprogress?: (event: ProgressEvent) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;

  constructor() {
    FakeXHR.last = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: unknown) {
    this.sent = body;
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  /** Drive the request to completion with a given status and body. */
  respond(status: number, body: string) {
    this.status = status;
    this.responseText = body;
    this.onload?.();
  }

  progress(loaded: number, total: number, lengthComputable = true) {
    this.upload.onprogress?.({ loaded, total, lengthComputable } as ProgressEvent);
  }
}

function fileNamed(name = "report.pdf", type = "application/pdf", size = 4): File {
  return new File(["a".repeat(size)], name, { type });
}

beforeEach(() => {
  FakeXHR.last = null;
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/* ─── startUpload ──────────────────────────────────────────────────────── */

describe("startUpload — the request", () => {
  it("posts to the endpoint for that form and field", () => {
    void startUpload({ formId: "form-1", fieldId: "field-1", file: fileNamed() });

    expect(FakeXHR.last?.method).toBe("POST");
    expect(FakeXHR.last?.url).toBe(`${ORIGIN}/uploads/form-1/field-1`);
  });

  it("sends cookies, because the endpoint may require a signed-in respondent", () => {
    void startUpload({ formId: "form-1", fieldId: "field-1", file: fileNamed() });
    expect(FakeXHR.last?.withCredentials).toBe(true);
  });

  it("sends the file as multipart form data under the name the API expects", () => {
    const file = fileNamed();
    void startUpload({ formId: "form-1", fieldId: "field-1", file });

    const body = FakeXHR.last?.sent as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("file")).toBe(file);
  });
});

describe("startUpload — success", () => {
  it("resolves with a pending reference once the API accepts the file", async () => {
    const pending = startUpload({ formId: "form-1", fieldId: "field-1", file: fileNamed() });

    FakeXHR.last!.respond(
      202,
      JSON.stringify({
        uploadId: "up_1",
        claimToken: "token-1",
        name: "report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4,
      }),
    );

    await expect(pending).resolves.toEqual({
      uploadId: "up_1",
      claimToken: "token-1",
      name: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4,
      status: "pending",
      url: null,
      error: null,
    });
  });

  it("falls back to what the browser knows about the file", async () => {
    const file = fileNamed("notes.txt", "text/plain", 9);
    const pending = startUpload({ formId: "f", fieldId: "q", file });

    FakeXHR.last!.respond(202, JSON.stringify({ uploadId: "up_1", claimToken: "token-1" }));

    await expect(pending).resolves.toMatchObject({
      name: "notes.txt",
      mimeType: "text/plain",
      sizeBytes: 9,
    });
  });

  it("never reports a fresh upload as ready", async () => {
    const pending = startUpload({ formId: "f", fieldId: "q", file: fileNamed() });
    FakeXHR.last!.respond(202, JSON.stringify({ uploadId: "up_1", claimToken: "t", status: "ready" }));
    await expect(pending).resolves.toMatchObject({ status: "pending" });
  });
});

describe("startUpload — progress", () => {
  it("reports whole percentages", async () => {
    const onProgress = vi.fn();
    const pending = startUpload({ formId: "f", fieldId: "q", file: fileNamed(), onProgress });

    FakeXHR.last!.progress(25, 100);
    FakeXHR.last!.progress(100, 100);

    expect(onProgress).toHaveBeenNthCalledWith(1, 25);
    expect(onProgress).toHaveBeenNthCalledWith(2, 100);

    FakeXHR.last!.respond(202, JSON.stringify({ uploadId: "u", claimToken: "t" }));
    await pending;
  });

  it("rounds rather than emitting a fraction", async () => {
    const onProgress = vi.fn();
    const pending = startUpload({ formId: "f", fieldId: "q", file: fileNamed(), onProgress });

    FakeXHR.last!.progress(1, 3);
    expect(onProgress).toHaveBeenCalledWith(33);

    FakeXHR.last!.respond(202, JSON.stringify({ uploadId: "u", claimToken: "t" }));
    await pending;
  });

  it("stays silent when the total size is unknown", async () => {
    const onProgress = vi.fn();
    const pending = startUpload({ formId: "f", fieldId: "q", file: fileNamed(), onProgress });

    FakeXHR.last!.progress(25, 0, false);
    expect(onProgress).not.toHaveBeenCalled();

    FakeXHR.last!.respond(202, JSON.stringify({ uploadId: "u", claimToken: "t" }));
    await pending;
  });

  it("does not require a progress callback", async () => {
    const pending = startUpload({ formId: "f", fieldId: "q", file: fileNamed() });
    expect(() => FakeXHR.last!.progress(50, 100)).not.toThrow();

    FakeXHR.last!.respond(202, JSON.stringify({ uploadId: "u", claimToken: "t" }));
    await pending;
  });
});

describe("startUpload — failure", () => {
  it("surfaces the API's own message and status", async () => {
    const pending = startUpload({ formId: "f", fieldId: "q", file: fileNamed() });
    FakeXHR.last!.respond(413, JSON.stringify({ error: "File is larger than 25MB" }));

    await expect(pending).rejects.toMatchObject({
      name: "UploadError",
      message: "File is larger than 25MB",
      status: 413,
    });
  });

  it("falls back to a generic message when a proxy answers with something that is not JSON", async () => {
    const pending = startUpload({ formId: "f", fieldId: "q", file: fileNamed() });
    FakeXHR.last!.respond(502, "<html>Bad Gateway</html>");

    await expect(pending).rejects.toMatchObject({ message: "Upload failed", status: 502 });
  });

  it("treats any status other than 202 as a failure, including 200", async () => {
    const pending = startUpload({ formId: "f", fieldId: "q", file: fileNamed() });
    FakeXHR.last!.respond(200, JSON.stringify({ uploadId: "u" }));
    await expect(pending).rejects.toBeInstanceOf(UploadError);
  });

  it("rejects on a transport error", async () => {
    const pending = startUpload({ formId: "f", fieldId: "q", file: fileNamed() });
    FakeXHR.last!.onerror?.();

    await expect(pending).rejects.toMatchObject({
      message: "Network error while uploading",
      status: 0,
    });
  });
});

describe("startUpload — cancellation", () => {
  it("aborts the request when the caller's signal fires", async () => {
    const controller = new AbortController();
    const pending = startUpload({
      formId: "f",
      fieldId: "q",
      file: fileNamed(),
      signal: controller.signal,
    });

    controller.abort();

    expect(FakeXHR.last?.aborted).toBe(true);
    await expect(pending).rejects.toMatchObject({ message: "Upload cancelled", status: 0 });
  });

  it("does not abort a request whose signal never fires", async () => {
    const controller = new AbortController();
    const pending = startUpload({
      formId: "f",
      fieldId: "q",
      file: fileNamed(),
      signal: controller.signal,
    });

    FakeXHR.last!.respond(202, JSON.stringify({ uploadId: "u", claimToken: "t" }));
    await pending;
    expect(FakeXHR.last?.aborted).toBe(false);
  });
});

/* ─── fetchUploadStatus ────────────────────────────────────────────────── */

describe("fetchUploadStatus", () => {
  const body = {
    uploadId: "up_1",
    status: "ready" as const,
    name: "report.pdf",
    mimeType: "application/pdf",
    sizeBytes: 4,
    url: "https://cdn.test/report.pdf",
    error: null,
  };

  function fetchReturning(ok: boolean, status = 200, json: unknown = body) {
    const mock = vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(json) });
    vi.stubGlobal("fetch", mock);
    return mock;
  }

  it("reads the upload by id, presenting the claim token", async () => {
    const mock = fetchReturning(true);
    await fetchUploadStatus("up_1", "token-1");

    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ORIGIN}/uploads/up_1`);
    expect((init.headers as Record<string, string>)["X-Upload-Token"]).toBe("token-1");
    expect(init.credentials).toBe("include");
  });

  it("returns the server's view with the caller's token folded back in", async () => {
    fetchReturning(true);
    await expect(fetchUploadStatus("up_1", "token-1")).resolves.toEqual({
      ...body,
      claimToken: "token-1",
    });
  });

  it("passes an abort signal through when given one", async () => {
    const mock = fetchReturning(true);
    const controller = new AbortController();
    await fetchUploadStatus("up_1", "token-1", controller.signal);

    expect((mock.mock.calls[0]![1] as RequestInit).signal).toBe(controller.signal);
  });

  it("omits the signal entirely when there is none", async () => {
    const mock = fetchReturning(true);
    await fetchUploadStatus("up_1", "token-1");
    expect("signal" in (mock.mock.calls[0]![1] as RequestInit)).toBe(false);
  });

  it("throws an UploadError carrying the response status", async () => {
    fetchReturning(false, 403);
    await expect(fetchUploadStatus("up_1", "wrong-token")).rejects.toMatchObject({
      name: "UploadError",
      message: "Could not read upload status",
      status: 403,
    });
  });
});

/* ─── waitForUpload ────────────────────────────────────────────────────── */

describe("waitForUpload", () => {
  const pendingRef: UploadedFileRef = {
    uploadId: "up_1",
    claimToken: "token-1",
    name: "report.pdf",
    mimeType: "application/pdf",
    sizeBytes: 4,
    status: "pending",
    url: null,
    error: null,
  };

  /** Queue one response body per poll. */
  function pollsReturning(...statuses: Array<UploadedFileRef["status"] | Error>) {
    const mock = vi.fn();
    for (const entry of statuses) {
      if (entry instanceof Error) mock.mockRejectedValueOnce(entry);
      else
        mock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              uploadId: "up_1",
              status: entry,
              name: "report.pdf",
              mimeType: "application/pdf",
              sizeBytes: 4,
              url: entry === "ready" ? "https://cdn.test/report.pdf" : null,
              error: entry === "failed" ? "storage rejected the file" : null,
            }),
        });
    }
    mock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ...pendingRef, status: "processing" }),
    });
    vi.stubGlobal("fetch", mock);
    return mock;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  it("resolves as soon as the upload is ready", async () => {
    pollsReturning("ready");
    const pending = waitForUpload(pendingRef);

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toMatchObject({
      timedOut: false,
      ref: { status: "ready", url: "https://cdn.test/report.pdf" },
    });
  });

  it("resolves on a terminal failure rather than polling on", async () => {
    pollsReturning("failed");
    const pending = waitForUpload(pendingRef);

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toMatchObject({
      timedOut: false,
      ref: { status: "failed", error: "storage rejected the file" },
    });
  });

  it("keeps polling while the worker is still busy", async () => {
    const mock = pollsReturning("pending", "processing", "ready");
    const pending = waitForUpload(pendingRef);

    await vi.advanceTimersByTimeAsync(10_000);
    await pending;

    expect(mock).toHaveBeenCalledTimes(3);
  });

  it("reports every intermediate state to the caller", async () => {
    pollsReturning("processing", "ready");
    const onUpdate = vi.fn();

    const pending = waitForUpload(pendingRef, { onUpdate });
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate.mock.calls[0]![0]).toMatchObject({ status: "processing" });
    expect(onUpdate.mock.calls[1]![0]).toMatchObject({ status: "ready" });
  });

  it("waits a second before the first poll, then backs off", async () => {
    const mock = pollsReturning("pending", "pending", "ready");
    const pending = waitForUpload(pendingRef);

    await vi.advanceTimersByTimeAsync(999);
    expect(mock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(mock).toHaveBeenCalledTimes(1);

    /* Next interval is 1.5x the last. */
    await vi.advanceTimersByTimeAsync(1_499);
    expect(mock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
  });

  it("treats a failed poll as a hiccup, not a failed upload", async () => {
    pollsReturning(new Error("network down"), "ready");
    const pending = waitForUpload(pendingRef);

    await vi.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toMatchObject({ timedOut: false, ref: { status: "ready" } });
  });

  it("gives up after two minutes and says it timed out", async () => {
    pollsReturning("pending");
    const pending = waitForUpload(pendingRef);

    await vi.advanceTimersByTimeAsync(130_000);

    await expect(pending).resolves.toMatchObject({ timedOut: true });
  });

  it("returns the last state it saw when it times out", async () => {
    pollsReturning("processing");
    const pending = waitForUpload(pendingRef);

    await vi.advanceTimersByTimeAsync(130_000);
    const { ref } = await pending;
    expect(ref.status).toBe("processing");
  });

  it("stops immediately when the caller has already given up", async () => {
    const mock = pollsReturning("ready");
    const controller = new AbortController();
    controller.abort();

    await expect(waitForUpload(pendingRef, { signal: controller.signal })).resolves.toEqual({
      ref: pendingRef,
      timedOut: false,
    });
    expect(mock).not.toHaveBeenCalled();
  });

  it("exposes a stable still-processing marker for callers to branch on", () => {
    expect(UPLOAD_STILL_PROCESSING).toBe("UPLOAD_STILL_PROCESSING");
  });
});
