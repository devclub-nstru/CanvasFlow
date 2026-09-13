import { describe, expect, it } from "vitest";
import {
  createFormSegmentInput,
  deleteFormSegmentInput,
  listFormSegmentsInput,
  updateFormSegmentInput,
} from "@repo/services/form-segment/model";
import { feedbackTypeSchema, submitFeedbackInput } from "@repo/services/feedback/model";
import { getSubmissionsInput, submitFormInput } from "@repo/services/form-submission/model";
import {
  createPendingUploadInput,
  fileUploadFieldOptions,
  getUploadStatusInput,
  markFailedInput,
  markReadyInput,
  storageKindFor,
  submittedUploadRef,
  UPLOAD_NOT_READY_ERROR,
} from "@repo/services/form-upload/model";
import {
  deleteDraftInput,
  getDraftInput,
  saveDraftInput,
} from "@repo/services/form-draft/model";

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const OTHER_UUID = "223e4567-e89b-12d3-a456-426614174001";

/* ─── Segments ─────────────────────────────────────────────────────────── */

describe("createFormSegmentInput", () => {
  const minimal = { formId: UUID, title: "About you" };

  it("accepts a minimal segment", () => {
    expect(createFormSegmentInput.safeParse(minimal).success).toBe(true);
  });

  it("adopts unassigned questions unless told otherwise", () => {
    expect(createFormSegmentInput.parse(minimal).adoptUnassignedFields).toBe(true);
    expect(
      createFormSegmentInput.parse({ ...minimal, adoptUnassignedFields: false })
        .adoptUnassignedFields,
    ).toBe(false);
  });

  it.each(["formId", "title"])("requires %s", (key) => {
    const input: Record<string, unknown> = { ...minimal };
    delete input[key];
    expect(createFormSegmentInput.safeParse(input).success).toBe(false);
  });

  it("rejects a title that is blank once trimmed", () => {
    expect(createFormSegmentInput.safeParse({ ...minimal, title: "   " }).success).toBe(false);
  });

  it("caps the title at 255 and the description at 2000", () => {
    expect(createFormSegmentInput.safeParse({ ...minimal, title: "a".repeat(255) }).success).toBe(
      true,
    );
    expect(createFormSegmentInput.safeParse({ ...minimal, title: "a".repeat(256) }).success).toBe(
      false,
    );
    expect(
      createFormSegmentInput.safeParse({ ...minimal, description: "a".repeat(2001) }).success,
    ).toBe(false);
  });

  it("normalises the index to a string", () => {
    expect(createFormSegmentInput.parse({ ...minimal, index: 2.5 }).index).toBe("2.5");
  });
});

describe("updateFormSegmentInput", () => {
  it("requires only the segment id", () => {
    expect(updateFormSegmentInput.safeParse({ id: UUID }).success).toBe(true);
    expect(updateFormSegmentInput.safeParse({ id: "nope" }).success).toBe(false);
  });

  it("still refuses to blank the title when one is supplied", () => {
    expect(updateFormSegmentInput.safeParse({ id: UUID, title: "  " }).success).toBe(false);
  });

  it("takes a non-negative integer optimistic-lock token", () => {
    expect(updateFormSegmentInput.safeParse({ id: UUID, expectedVersion: 0 }).success).toBe(true);
    expect(updateFormSegmentInput.safeParse({ id: UUID, expectedVersion: -1 }).success).toBe(false);
  });
});

describe("the remaining segment schemas", () => {
  it("delete and list both require a UUID", () => {
    expect(deleteFormSegmentInput.safeParse({ id: UUID }).success).toBe(true);
    expect(deleteFormSegmentInput.safeParse({}).success).toBe(false);
    expect(listFormSegmentsInput.safeParse({ formId: UUID }).success).toBe(true);
    expect(listFormSegmentsInput.safeParse({ formId: "nope" }).success).toBe(false);
  });
});

/* ─── Feedback ─────────────────────────────────────────────────────────── */

describe("feedbackTypeSchema", () => {
  it("covers the four things a person can report", () => {
    expect(feedbackTypeSchema.options).toEqual(["bug", "feedback", "complaint", "feature_request"]);
  });
});

describe("submitFeedbackInput", () => {
  const minimal = { subject: "Cannot publish", message: "The publish button does nothing." };

  it("accepts a minimal report and defaults the type", () => {
    expect(submitFeedbackInput.parse(minimal).type).toBe("feedback");
  });

  it("rejects a type that is not one of the four", () => {
    expect(submitFeedbackInput.safeParse({ ...minimal, type: "rant" }).success).toBe(false);
  });

  it("demands a subject long enough to scan", () => {
    expect(submitFeedbackInput.safeParse({ ...minimal, subject: "ab" }).success).toBe(false);
    expect(submitFeedbackInput.safeParse({ ...minimal, subject: "abc" }).success).toBe(true);
  });

  it("demands a message with some detail in it", () => {
    expect(submitFeedbackInput.safeParse({ ...minimal, message: "broken" }).success).toBe(false);
    expect(submitFeedbackInput.safeParse({ ...minimal, message: "a".repeat(10) }).success).toBe(
      true,
    );
  });

  it("counts length after trimming, so padding cannot pad a report out", () => {
    expect(submitFeedbackInput.safeParse({ ...minimal, subject: `  ab  ` }).success).toBe(false);
  });

  it("caps the subject, the message and the page URL", () => {
    expect(submitFeedbackInput.safeParse({ ...minimal, subject: "a".repeat(121) }).success).toBe(
      false,
    );
    expect(submitFeedbackInput.safeParse({ ...minimal, message: "a".repeat(1001) }).success).toBe(
      false,
    );
    expect(submitFeedbackInput.safeParse({ ...minimal, pageUrl: "a".repeat(2049) }).success).toBe(
      false,
    );
  });

  it("carries the page URL when there is one", () => {
    expect(
      submitFeedbackInput.parse({ ...minimal, pageUrl: "https://app.test/forms/abc" }).pageUrl,
    ).toBe("https://app.test/forms/abc");
    expect(submitFeedbackInput.safeParse({ ...minimal, pageUrl: null }).success).toBe(true);
  });

  it("reports a message a person can act on, not a schema dump", () => {
    const result = submitFeedbackInput.safeParse({ ...minimal, message: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Please add a little more detail");
    }
  });
});

/* ─── Submissions ──────────────────────────────────────────────────────── */

describe("submitFormInput", () => {
  const minimal = { formId: UUID, values: [] };

  it("accepts an empty submission, leaving required-field checks to the service", () => {
    expect(submitFormInput.safeParse(minimal).success).toBe(true);
  });

  it("requires a form id and a values array", () => {
    expect(submitFormInput.safeParse({ values: [] }).success).toBe(false);
    expect(submitFormInput.safeParse({ formId: UUID }).success).toBe(false);
    expect(submitFormInput.safeParse({ formId: UUID, values: "nope" }).success).toBe(false);
  });

  it("requires each value to name a field by UUID", () => {
    expect(
      submitFormInput.safeParse({ ...minimal, values: [{ formFieldId: UUID, value: "x" }] }).success,
    ).toBe(true);
    expect(
      submitFormInput.safeParse({ ...minimal, values: [{ formFieldId: "nope", value: "x" }] })
        .success,
    ).toBe(false);
  });

  it("accepts any answer shape, since the field type decides what is valid", () => {
    for (const value of ["text", 3, true, ["a"], { uploadId: UUID }, null]) {
      expect(
        submitFormInput.safeParse({ ...minimal, values: [{ formFieldId: UUID, value }] }).success,
      ).toBe(true);
    }
  });

  it("bounds every attribution field a client can set", () => {
    expect(submitFormInput.safeParse({ ...minimal, idempotencyKey: "a".repeat(65) }).success).toBe(
      false,
    );
    expect(submitFormInput.safeParse({ ...minimal, visitorId: "a".repeat(65) }).success).toBe(false);
    expect(submitFormInput.safeParse({ ...minimal, referrer: "a".repeat(2049) }).success).toBe(
      false,
    );
    expect(submitFormInput.safeParse({ ...minimal, utmSource: "a".repeat(256) }).success).toBe(
      false,
    );
    expect(submitFormInput.safeParse({ ...minimal, utmMedium: "a".repeat(256) }).success).toBe(
      false,
    );
    expect(submitFormInput.safeParse({ ...minimal, utmCampaign: "a".repeat(256) }).success).toBe(
      false,
    );
  });

  it("accepts only the three device types", () => {
    for (const deviceType of ["desktop", "mobile", "tablet"]) {
      expect(submitFormInput.safeParse({ ...minimal, deviceType }).success).toBe(true);
    }
    expect(submitFormInput.safeParse({ ...minimal, deviceType: "watch" }).success).toBe(false);
    expect(submitFormInput.safeParse({ ...minimal, deviceType: null }).success).toBe(true);
  });

  it("requires the time spent to be a whole number of milliseconds", () => {
    expect(submitFormInput.safeParse({ ...minimal, timeSpentMs: 1500 }).success).toBe(true);
    expect(submitFormInput.safeParse({ ...minimal, timeSpentMs: 1.5 }).success).toBe(false);
  });
});

describe("getSubmissionsInput", () => {
  const minimal = { formId: UUID, ownerId: "user-1" };

  it("defaults to a page of fifty", () => {
    expect(getSubmissionsInput.parse(minimal).limit).toBe(50);
  });

  it("bounds the page size", () => {
    expect(getSubmissionsInput.safeParse({ ...minimal, limit: 1 }).success).toBe(true);
    expect(getSubmissionsInput.safeParse({ ...minimal, limit: 200 }).success).toBe(true);
    expect(getSubmissionsInput.safeParse({ ...minimal, limit: 0 }).success).toBe(false);
    expect(getSubmissionsInput.safeParse({ ...minimal, limit: 201 }).success).toBe(false);
    expect(getSubmissionsInput.safeParse({ ...minimal, limit: 10.5 }).success).toBe(false);
  });

  it("requires the cursor to be a real timestamp", () => {
    expect(
      getSubmissionsInput.safeParse({ ...minimal, cursor: "2026-01-01T00:00:00.000Z" }).success,
    ).toBe(true);
    expect(getSubmissionsInput.safeParse({ ...minimal, cursor: "yesterday" }).success).toBe(false);
    expect(getSubmissionsInput.safeParse({ ...minimal, cursor: null }).success).toBe(true);
  });

  it("requires both the form and the owner", () => {
    expect(getSubmissionsInput.safeParse({ formId: UUID }).success).toBe(false);
    expect(getSubmissionsInput.safeParse({ ownerId: "user-1" }).success).toBe(false);
  });
});

/* ─── Uploads ──────────────────────────────────────────────────────────── */

describe("fileUploadFieldOptions", () => {
  it("accepts a field with no restrictions at all", () => {
    expect(fileUploadFieldOptions.safeParse({}).success).toBe(true);
  });

  it("coerces the numeric limits, because they arrive from form inputs as strings", () => {
    const parsed = fileUploadFieldOptions.parse({ maxMb: "25", maxFiles: "3" });
    expect(parsed.maxMb).toBe(25);
    expect(parsed.maxFiles).toBe(3);
  });

  it("refuses a size limit that is zero, negative or absurd", () => {
    expect(fileUploadFieldOptions.safeParse({ maxMb: 0 }).success).toBe(false);
    expect(fileUploadFieldOptions.safeParse({ maxMb: -1 }).success).toBe(false);
    expect(fileUploadFieldOptions.safeParse({ maxMb: 1025 }).success).toBe(false);
    expect(fileUploadFieldOptions.safeParse({ maxMb: 1024 }).success).toBe(true);
  });

  it("bounds how many files one question may take", () => {
    expect(fileUploadFieldOptions.safeParse({ maxFiles: 0 }).success).toBe(false);
    expect(fileUploadFieldOptions.safeParse({ maxFiles: 20 }).success).toBe(true);
    expect(fileUploadFieldOptions.safeParse({ maxFiles: 21 }).success).toBe(false);
    expect(fileUploadFieldOptions.safeParse({ maxFiles: 1.5 }).success).toBe(false);
  });

  it("bounds the accept list", () => {
    expect(fileUploadFieldOptions.safeParse({ accept: ["image/png", ".pdf"] }).success).toBe(true);
    expect(
      fileUploadFieldOptions.safeParse({ accept: Array.from({ length: 51 }, () => "image/png") })
        .success,
    ).toBe(false);
    expect(fileUploadFieldOptions.safeParse({ accept: ["a".repeat(101)] }).success).toBe(false);
  });
});

describe("createPendingUploadInput", () => {
  const minimal = {
    formId: UUID,
    formFieldId: OTHER_UUID,
    originalName: "report.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    storedPath: "/tmp/uploads/abc",
  };

  it("accepts a complete record", () => {
    expect(createPendingUploadInput.safeParse(minimal).success).toBe(true);
  });

  it.each(Object.keys(minimal))("requires %s", (key) => {
    const input: Record<string, unknown> = { ...minimal };
    delete input[key];
    expect(createPendingUploadInput.safeParse(input).success).toBe(false);
  });

  it("allows a zero-byte file but not a negative or fractional size", () => {
    expect(createPendingUploadInput.safeParse({ ...minimal, sizeBytes: 0 }).success).toBe(true);
    expect(createPendingUploadInput.safeParse({ ...minimal, sizeBytes: -1 }).success).toBe(false);
    expect(createPendingUploadInput.safeParse({ ...minimal, sizeBytes: 1.5 }).success).toBe(false);
  });

  it("bounds the browser-supplied filename and content type", () => {
    expect(
      createPendingUploadInput.safeParse({ ...minimal, originalName: "a".repeat(256) }).success,
    ).toBe(false);
    expect(createPendingUploadInput.safeParse({ ...minimal, mimeType: "a".repeat(128) }).success).toBe(
      false,
    );
    expect(createPendingUploadInput.safeParse({ ...minimal, originalName: "   " }).success).toBe(
      false,
    );
  });
});

describe("the upload claim schemas", () => {
  it("require a UUID and a bounded claim token", () => {
    for (const schema of [getUploadStatusInput, submittedUploadRef]) {
      expect(schema.safeParse({ uploadId: UUID, claimToken: "abc" }).success).toBe(true);
      expect(schema.safeParse({ uploadId: "nope", claimToken: "abc" }).success).toBe(false);
      expect(schema.safeParse({ uploadId: UUID }).success).toBe(false);
      expect(schema.safeParse({ uploadId: UUID, claimToken: "" }).success).toBe(false);
      expect(schema.safeParse({ uploadId: UUID, claimToken: "a".repeat(65) }).success).toBe(false);
    }
  });
});

describe("markReadyInput and markFailedInput", () => {
  it("record where a finished upload landed", () => {
    expect(
      markReadyInput.safeParse({
        uploadId: UUID,
        cloudinaryPublicId: "cf/form/upload",
        cloudinaryUrl: "https://res.cloudinary.com/x",
        cloudinaryResourceType: "raw",
      }).success,
    ).toBe(true);
  });

  it("refuse a blank destination", () => {
    expect(
      markReadyInput.safeParse({
        uploadId: UUID,
        cloudinaryPublicId: "",
        cloudinaryUrl: "https://x",
        cloudinaryResourceType: "raw",
      }).success,
    ).toBe(false);
  });

  it("bound the stored error so a provider's essay cannot fill a column", () => {
    expect(markFailedInput.safeParse({ uploadId: UUID, error: "a".repeat(2000) }).success).toBe(
      true,
    );
    expect(markFailedInput.safeParse({ uploadId: UUID, error: "a".repeat(2001) }).success).toBe(
      false,
    );
  });
});

describe("storageKindFor", () => {
  it.each([
    ["image/png", "image"],
    ["image/JPEG", "image"],
    ["video/mp4", "video"],
    ["audio/mpeg", "video"],
    ["application/pdf", "raw"],
    ["text/csv", "raw"],
    ["", "raw"],
  ])("maps %s to %s", (mimeType, expected) => {
    expect(storageKindFor(mimeType)).toBe(expected);
  });

  it("groups audio with video, because that is the bucket the provider uses", () => {
    expect(storageKindFor("audio/wav")).toBe(storageKindFor("video/webm"));
  });

  it("exposes a stable not-ready error code", () => {
    expect(UPLOAD_NOT_READY_ERROR).toBe("UPLOAD_NOT_READY");
  });
});

/* ─── Drafts ───────────────────────────────────────────────────────────── */

describe("saveDraftInput", () => {
  const minimal = { formId: UUID, values: {} };

  it("accepts an empty draft", () => {
    expect(saveDraftInput.safeParse(minimal).success).toBe(true);
  });

  it("keys answers by field id and accepts any value", () => {
    expect(
      saveDraftInput.safeParse({ ...minimal, values: { [UUID]: "text", [OTHER_UUID]: ["a"] } })
        .success,
    ).toBe(true);
  });

  it("rejects a values array, which would silently lose the keys", () => {
    expect(saveDraftInput.safeParse({ ...minimal, values: [] }).success).toBe(false);
  });

  it("records the pages visited as non-negative integers", () => {
    expect(saveDraftInput.safeParse({ ...minimal, pagePath: [0, 1, 4] }).success).toBe(true);
    expect(saveDraftInput.safeParse({ ...minimal, pagePath: [-1] }).success).toBe(false);
    expect(saveDraftInput.safeParse({ ...minimal, pagePath: [1.5] }).success).toBe(false);
    expect(saveDraftInput.safeParse({ ...minimal, pagePath: ["1"] }).success).toBe(false);
  });

  it("requires the form id", () => {
    expect(saveDraftInput.safeParse({ values: {} }).success).toBe(false);
  });
});

describe("getDraftInput and deleteDraftInput", () => {
  it("both take just the form", () => {
    expect(getDraftInput.safeParse({ formId: UUID }).success).toBe(true);
    expect(deleteDraftInput.safeParse({ formId: UUID }).success).toBe(true);
    expect(getDraftInput.safeParse({ formId: "nope" }).success).toBe(false);
    expect(deleteDraftInput.safeParse({}).success).toBe(false);
  });
});
