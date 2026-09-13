import { describe, expect, it } from "vitest";
import {
  createFormFieldInput,
  deleteFormFieldInput,
  fieldTypeZodEnum,
  updateFormFieldInput,
} from "@repo/services/form-field/model";
import {
  createFormInput,
  getFormInput,
  questionLayoutZodEnum,
  updateFormSettingsInput,
} from "@repo/services/form/model";

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const OTHER_UUID = "223e4567-e89b-12d3-a456-426614174001";

/* ─── Field types ──────────────────────────────────────────────────────── */

describe("fieldTypeZodEnum", () => {
  it("covers every question type the builder can create", () => {
    expect(fieldTypeZodEnum.options).toEqual([
      "TEXT",
      "TEXTAREA",
      "NUMBER",
      "EMAIL",
      "PHONE",
      "URL",
      "SELECT",
      "RADIO",
      "CHECKBOX",
      "DATE",
      "RATING",
      "FILE_UPLOAD",
      "TIME",
      "DATETIME",
      "SLIDER",
      "TOGGLE",
    ]);
  });

  it("rejects a type that is not on the list", () => {
    expect(fieldTypeZodEnum.safeParse("SIGNATURE").success).toBe(false);
  });
});

/* ─── createFormFieldInput ─────────────────────────────────────────────── */

describe("createFormFieldInput", () => {
  const minimal = { formId: UUID, label: "Your name", type: "TEXT" };

  it("accepts a minimal field and defaults it to optional", () => {
    const parsed = createFormFieldInput.parse(minimal);
    expect(parsed.isRequired).toBe(false);
  });

  it.each(["formId", "label", "type"])("requires %s", (key) => {
    const input: Record<string, unknown> = { ...minimal };
    delete input[key];
    expect(createFormFieldInput.safeParse(input).success).toBe(false);
  });

  it("requires the parent form id to be a UUID", () => {
    expect(createFormFieldInput.safeParse({ ...minimal, formId: "nope" }).success).toBe(false);
  });

  it("accepts a null segment, meaning the implicit first segment", () => {
    expect(createFormFieldInput.safeParse({ ...minimal, segmentId: null }).success).toBe(true);
    expect(createFormFieldInput.safeParse({ ...minimal, segmentId: OTHER_UUID }).success).toBe(true);
    expect(createFormFieldInput.safeParse({ ...minimal, segmentId: "nope" }).success).toBe(false);
  });

  it("trims the label rather than storing the padding", () => {
    expect(createFormFieldInput.parse({ ...minimal, label: "  Your name  " }).label).toBe(
      "Your name",
    );
  });

  it("accepts a label at the 255 character ceiling and rejects one past it", () => {
    expect(createFormFieldInput.safeParse({ ...minimal, label: "a".repeat(255) }).success).toBe(
      true,
    );
    expect(createFormFieldInput.safeParse({ ...minimal, label: "a".repeat(256) }).success).toBe(
      false,
    );
  });

  it("accepts a description up to 2000 characters", () => {
    expect(
      createFormFieldInput.safeParse({ ...minimal, description: "a".repeat(2000) }).success,
    ).toBe(true);
    expect(
      createFormFieldInput.safeParse({ ...minimal, description: "a".repeat(2001) }).success,
    ).toBe(false);
  });

  it("normalises the index to a string so fractional ordering survives", () => {
    expect(createFormFieldInput.parse({ ...minimal, index: 1.5 }).index).toBe("1.5");
    expect(createFormFieldInput.parse({ ...minimal, index: "2" }).index).toBe("2");
  });

  it("leaves the options blob unvalidated, because its shape depends on the type", () => {
    for (const options of [["a", "b"], { choices: ["a"] }, null]) {
      expect(createFormFieldInput.safeParse({ ...minimal, options }).success).toBe(true);
    }
  });
});

/* ─── updateFormFieldInput ─────────────────────────────────────────────── */

describe("updateFormFieldInput", () => {
  it("requires only the field id", () => {
    expect(updateFormFieldInput.safeParse({ id: UUID }).success).toBe(true);
    expect(updateFormFieldInput.safeParse({}).success).toBe(false);
    expect(updateFormFieldInput.safeParse({ id: "nope" }).success).toBe(false);
  });

  it("takes an optimistic-lock token that must be a non-negative integer", () => {
    expect(updateFormFieldInput.safeParse({ id: UUID, expectedVersion: 0 }).success).toBe(true);
    expect(updateFormFieldInput.safeParse({ id: UUID, expectedVersion: 7 }).success).toBe(true);
    expect(updateFormFieldInput.safeParse({ id: UUID, expectedVersion: -1 }).success).toBe(false);
    expect(updateFormFieldInput.safeParse({ id: UUID, expectedVersion: 1.5 }).success).toBe(false);
    expect(updateFormFieldInput.safeParse({ id: UUID, expectedVersion: "3" }).success).toBe(false);
  });

  it("allows clearing a nullable field", () => {
    expect(
      updateFormFieldInput.safeParse({ id: UUID, placeholder: null, description: null }).success,
    ).toBe(true);
  });

  it("still validates the type when one is supplied", () => {
    expect(updateFormFieldInput.safeParse({ id: UUID, type: "TEXT" }).success).toBe(true);
    expect(updateFormFieldInput.safeParse({ id: UUID, type: "SIGNATURE" }).success).toBe(false);
  });
});

describe("deleteFormFieldInput", () => {
  it("requires a UUID", () => {
    expect(deleteFormFieldInput.safeParse({ id: UUID }).success).toBe(true);
    expect(deleteFormFieldInput.safeParse({ id: "nope" }).success).toBe(false);
  });
});

/* ─── createFormInput ──────────────────────────────────────────────────── */

describe("createFormInput", () => {
  const minimal = { title: "Feedback", slug: "feedback", ownerId: "user_1" };

  it("accepts a minimal form", () => {
    expect(createFormInput.safeParse(minimal).success).toBe(true);
  });

  it.each(["title", "slug", "ownerId"])("requires %s", (key) => {
    const input: Record<string, unknown> = { ...minimal };
    delete input[key];
    expect(createFormInput.safeParse(input).success).toBe(false);
  });

  it("rejects a blank title, before and after trimming", () => {
    expect(createFormInput.safeParse({ ...minimal, title: "" }).success).toBe(false);
    expect(createFormInput.safeParse({ ...minimal, title: "   " }).success).toBe(false);
  });

  it("caps the title at 150 characters", () => {
    expect(createFormInput.safeParse({ ...minimal, title: "a".repeat(150) }).success).toBe(true);
    expect(createFormInput.safeParse({ ...minimal, title: "a".repeat(151) }).success).toBe(false);
  });

  it.each(["feedback", "q4-feedback", "form-2026", "a", "a1-b2-c3"])(
    "accepts the URL-safe slug %j",
    (slug) => {
      expect(createFormInput.safeParse({ ...minimal, slug }).success).toBe(true);
    },
  );

  it.each([
    ["uppercase", "Feedback"],
    ["a space", "my form"],
    ["an underscore", "my_form"],
    ["a leading hyphen", "-form"],
    ["a trailing hyphen", "form-"],
    ["a double hyphen", "my--form"],
    ["a slash", "forms/abc"],
    ["a dot", "form.1"],
    ["an empty string", ""],
    ["path traversal", "../admin"],
  ])("rejects a slug with %s", (_label, slug) => {
    expect(createFormInput.safeParse({ ...minimal, slug }).success).toBe(false);
  });
});

describe("getFormInput", () => {
  it("requires a UUID", () => {
    expect(getFormInput.safeParse({ id: UUID }).success).toBe(true);
    expect(getFormInput.safeParse({ id: "feedback" }).success).toBe(false);
  });
});

/* ─── updateFormSettingsInput ──────────────────────────────────────────── */

describe("questionLayoutZodEnum", () => {
  it("matches the layouts the renderer can resolve", () => {
    expect(questionLayoutZodEnum.options).toEqual([
      "AUTO",
      "ONE_PER_PAGE",
      "SEGMENT_PER_PAGE",
      "ALL_AT_ONCE",
    ]);
  });
});

describe("updateFormSettingsInput", () => {
  const minimal = { id: UUID, title: "Feedback", isOpen: true };

  it("accepts the minimum a settings save must carry", () => {
    expect(updateFormSettingsInput.safeParse(minimal).success).toBe(true);
  });

  it.each(["id", "title", "isOpen"])("requires %s", (key) => {
    const input: Record<string, unknown> = { ...minimal };
    delete input[key];
    expect(updateFormSettingsInput.safeParse(input).success).toBe(false);
  });

  it("rejects a blank title", () => {
    expect(updateFormSettingsInput.safeParse({ ...minimal, title: "   " }).success).toBe(false);
  });

  it("accepts every access flag", () => {
    expect(
      updateFormSettingsInput.safeParse({
        ...minimal,
        requireSignIn: true,
        collectRespondentEmail: true,
        oneResponsePerRespondent: true,
      }).success,
    ).toBe(true);
  });

  it("accepts a domain allow-list and caps it at twenty entries", () => {
    const domains = (n: number) => Array.from({ length: n }, (_, i) => `d${i}.example.com`);
    expect(
      updateFormSettingsInput.safeParse({ ...minimal, allowedEmailDomains: domains(20) }).success,
    ).toBe(true);
    expect(
      updateFormSettingsInput.safeParse({ ...minimal, allowedEmailDomains: domains(21) }).success,
    ).toBe(false);
  });

  it("rejects a blank entry in the allow-list", () => {
    expect(
      updateFormSettingsInput.safeParse({ ...minimal, allowedEmailDomains: ["  "] }).success,
    ).toBe(false);
  });

  it("allows clearing the allow-list", () => {
    expect(
      updateFormSettingsInput.safeParse({ ...minimal, allowedEmailDomains: null }).success,
    ).toBe(true);
    expect(updateFormSettingsInput.safeParse({ ...minimal, allowedEmailDomains: [] }).success).toBe(
      true,
    );
  });

  it("validates the layout when one is supplied", () => {
    expect(
      updateFormSettingsInput.safeParse({ ...minimal, questionLayout: "ALL_AT_ONCE" }).success,
    ).toBe(true);
    expect(
      updateFormSettingsInput.safeParse({ ...minimal, questionLayout: "CAROUSEL" }).success,
    ).toBe(false);
  });

  it("caps the thank-you message", () => {
    expect(
      updateFormSettingsInput.safeParse({ ...minimal, thankYouMessage: "a".repeat(2000) }).success,
    ).toBe(true);
    expect(
      updateFormSettingsInput.safeParse({ ...minimal, thankYouMessage: "a".repeat(2001) }).success,
    ).toBe(false);
  });
});
