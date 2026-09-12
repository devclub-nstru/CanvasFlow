import { describe, expect, it } from "vitest";
import {
  UploadError,
  apiOrigin,
  downloadUrlFor,
  formatBytes,
  isUploadAnswerComplete,
  limitLabel,
  stripUploadSecrets,
  type UploadLimits,
  type UploadedFileRef,
} from "~/lib/upload";

function ref(extra: Partial<UploadedFileRef> = {}): UploadedFileRef {
  return {
    uploadId: "up_1",
    claimToken: "secret-token",
    name: "file.png",
    mimeType: "image/png",
    sizeBytes: 10,
    status: "ready",
    url: "https://cdn.test/file.png",
    error: null,
    ...extra,
  };
}

describe("apiOrigin", () => {
  it("falls back to the local API when no origin is configured", () => {
    expect(apiOrigin()).toBe("http://localhost:8000");
  });

  it("never ends in a slash or the trpc suffix", () => {
    expect(apiOrigin()).not.toMatch(/\/$/);
    expect(apiOrigin()).not.toMatch(/\/trpc$/);
  });
});

describe("UploadError", () => {
  it("carries the HTTP status alongside the message", () => {
    const error = new UploadError("too big", 413);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("UploadError");
    expect(error.message).toBe("too big");
    expect(error.status).toBe(413);
  });
});

describe("formatBytes", () => {
  it.each<[number, string]>([
    [0, "0 B"],
    [1, "1 B"],
    [1023, "1023 B"],
    [1024, "1 KB"],
    [1536, "2 KB"],
    [1024 * 1024 - 1, "1024 KB"],
    [1024 * 1024, "1.0 MB"],
    [5 * 1024 * 1024, "5.0 MB"],
    [1.5 * 1024 * 1024, "1.5 MB"],
  ])("%i bytes reads as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe("isUploadAnswerComplete", () => {
  it("accepts a single ready upload", () => {
    expect(isUploadAnswerComplete(ref())).toBe(true);
  });

  it("accepts a list where every upload is ready", () => {
    expect(isUploadAnswerComplete([ref(), ref({ uploadId: "up_2" })])).toBe(true);
  });

  it.each<UploadedFileRef["status"]>(["pending", "processing", "failed"])(
    "rejects an upload still in %s",
    (status) => {
      expect(isUploadAnswerComplete(ref({ status }))).toBe(false);
    },
  );

  it("rejects a list with one unfinished upload", () => {
    expect(isUploadAnswerComplete([ref(), ref({ status: "pending" })])).toBe(false);
  });

  it("rejects an empty list", () => {
    expect(isUploadAnswerComplete([])).toBe(false);
  });

  it("rejects anything that is not an upload reference", () => {
    expect(isUploadAnswerComplete(null)).toBe(false);
    expect(isUploadAnswerComplete(undefined)).toBe(false);
    expect(isUploadAnswerComplete("up_1")).toBe(false);
    expect(isUploadAnswerComplete({ status: "ready" })).toBe(false);
  });
});

describe("stripUploadSecrets", () => {
  it("removes the claim token from a single reference", () => {
    const stripped = stripUploadSecrets(ref()) as Record<string, unknown>;
    expect(stripped).not.toHaveProperty("claimToken");
    expect(stripped.uploadId).toBe("up_1");
  });

  it("removes the claim token from every reference in a list", () => {
    const stripped = stripUploadSecrets([ref(), ref({ uploadId: "up_2" })]) as Array<
      Record<string, unknown>
    >;
    expect(stripped.every((entry) => !("claimToken" in entry))).toBe(true);
  });

  it("does not mutate the value it was given", () => {
    const original = ref();
    stripUploadSecrets(original);
    expect(original.claimToken).toBe("secret-token");
  });

  it("passes through values that carry no token", () => {
    expect(stripUploadSecrets("plain")).toBe("plain");
    expect(stripUploadSecrets(null)).toBeNull();
    expect(stripUploadSecrets({ a: 1 })).toEqual({ a: 1 });
  });
});

describe("downloadUrlFor", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/v123/abc.png";

  it("inserts a Cloudinary attachment transform named after the original file", () => {
    expect(downloadUrlFor(url, "My Report.pdf")).toBe(
      "https://res.cloudinary.com/demo/image/upload/fl_attachment:My-Report/v123/abc.png",
    );
  });

  it("drops the extension and collapses runs of punctuation", () => {
    expect(downloadUrlFor(url, "Q4 // results (final).xlsx")).toContain(
      "fl_attachment:Q4-results-final",
    );
  });

  it("caps a very long name", () => {
    const long = `${"a".repeat(200)}.pdf`;
    const slug = downloadUrlFor(url, long).split("fl_attachment:")[1]?.split("/")[0] ?? "";
    expect(slug).toHaveLength(80);
  });

  it("returns the URL untouched when it is not a Cloudinary upload URL", () => {
    const other = "https://example.test/files/abc.png";
    expect(downloadUrlFor(other, "name.pdf")).toBe(other);
  });

  it("returns the URL untouched when the name yields no usable slug", () => {
    expect(downloadUrlFor(url, "....")).toBe(url);
    expect(downloadUrlFor(url, "!!!.pdf")).toBe(url);
  });

  it("escapes anything unsafe that survives slugging", () => {
    expect(downloadUrlFor(url, "a b.pdf")).not.toContain(" ");
  });
});

describe("limitLabel", () => {
  const limits: UploadLimits = { maxMb: 100, image: 20, video: 50, raw: 10 };

  it("falls back to the author's own ceiling when the server limits are unknown", () => {
    expect(limitLabel(undefined, 10, null)).toBe("up to 10MB");
  });

  it("says nothing when neither side has a limit", () => {
    expect(limitLabel(undefined, undefined, null)).toBeNull();
  });

  it("reports a single figure when one kind of file is accepted", () => {
    expect(limitLabel(["image/*"], undefined, limits)).toBe("up to 20MB");
    expect(limitLabel(["audio/mpeg"], undefined, limits)).toBe("up to 50MB");
    expect(limitLabel(["application/pdf"], undefined, limits)).toBe("up to 10MB");
  });

  it("breaks the figure down when the kinds differ", () => {
    expect(limitLabel(undefined, undefined, limits)).toBe(
      "documents up to 10MB · images up to 20MB · audio/video up to 50MB",
    );
  });

  it("treats an extension rule as accepting anything", () => {
    expect(limitLabel([".pdf"], undefined, limits)).toBe(
      "documents up to 10MB · images up to 20MB · audio/video up to 50MB",
    );
  });

  it("collapses to one figure once the author's ceiling is the binding limit", () => {
    expect(limitLabel(undefined, 5, limits)).toBe("up to 5MB");
  });

  it("never advertises more than the global ceiling", () => {
    expect(limitLabel(["image/*"], 999, { ...limits, maxMb: 8 })).toBe("up to 8MB");
  });

  it("ignores casing and padding in the accept rules", () => {
    expect(limitLabel([" IMAGE/PNG "], undefined, limits)).toBe("up to 20MB");
  });
});
