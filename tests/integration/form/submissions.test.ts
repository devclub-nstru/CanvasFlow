import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "@repo/database";
import { formsTable } from "@repo/database/models/form";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { db, resetDatabase, teardownDatabase } from "../helpers/db";
import { closeRedis, resetRedis } from "../helpers/redis";
import { anonymousCaller, callerFor, expectRejection } from "../helpers/caller";
import { makeField, makeForm, makeUser, type TestForm, type TestUser } from "../helpers/factories";

/* Responding to a form.
 *
 * The access rules have thorough unit coverage on both copies of the logic, but
 * those tests hand `assertRespondentAllowed` a rules object and a respondent.
 * Nothing there proves the flags actually reach it from the form row, that the
 * one-response limit survives a real unique index, or that an idempotency key
 * deduplicates rather than erroring. */

let owner: TestUser;

async function publishedForm(
  overrides: Partial<typeof formsTable.$inferInsert> = {},
): Promise<{ form: TestForm; fieldId: string }> {
  const form = await makeForm(owner, { isPublished: true, ...overrides });
  const field = await makeField(form, { label: "How was it?" });
  return { form, fieldId: field.id };
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

/* ─── Gates on the form itself ─────────────────────────────────────────── */

describe("form.submitForm — whether the form is accepting answers", () => {
  it("accepts a response to an open, published form", async () => {
    const { form, fieldId } = await publishedForm();

    const { id } = await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fieldId, value: "Good" }],
    });

    const [row] = await db
      .select()
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.id, id));
    expect(row?.formId).toBe(form.id);
  });

  it("refuses an unpublished form", async () => {
    const form = await makeForm(owner);
    const field = await makeField(form);

    const error = await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: field.id, value: "x" }],
      }),
    );
    expect(error.message).toMatch(/not published/i);
  });

  it("refuses an archived form", async () => {
    const { form, fieldId } = await publishedForm({ isArchived: true });
    const error = await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "x" }],
      }),
    );
    expect(error.message).toMatch(/archived/i);
  });

  it("refuses a closed form", async () => {
    const { form, fieldId } = await publishedForm({ isOpen: false });
    const error = await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "x" }],
      }),
    );
    expect(error.message).toMatch(/closed/i);
  });

  it("refuses an expired form", async () => {
    const { form, fieldId } = await publishedForm({
      expiresAt: new Date(Date.now() - 60_000),
    });
    const error = await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "x" }],
      }),
    );
    expect(error.message).toMatch(/expired/i);
  });

  it("accepts a form whose expiry is still ahead", async () => {
    const { form, fieldId } = await publishedForm({
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "x" }],
      }),
    ).resolves.toBeDefined();
  });

  it("records nothing when it refuses", async () => {
    const { form, fieldId } = await publishedForm({ isOpen: false });
    await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "x" }],
      }),
    );
    expect(await db.select().from(formSubmissionsTable)).toHaveLength(0);
  });
});

/* ─── Who is allowed to respond ────────────────────────────────────────── */

describe("form.submitForm — who may respond", () => {
  it("turns an anonymous responder away when sign-in is required", async () => {
    const { form, fieldId } = await publishedForm({ requireSignIn: true });

    const error = await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "x" }],
      }),
    );
    expect(error.message).toBe("SIGN_IN_REQUIRED");
  });

  it("lets a signed-in responder through", async () => {
    const { form, fieldId } = await publishedForm({ requireSignIn: true });
    const responder = await makeUser({ email: "person@example.test" });

    await expect(
      (await callerFor(responder)).form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "x" }],
      }),
    ).resolves.toBeDefined();
  });

  it("enforces the domain allow-list", async () => {
    const { form, fieldId } = await publishedForm({
      requireSignIn: true,
      allowedEmailDomains: ["allowed.test"],
    });

    const outsider = await makeUser({ email: "person@elsewhere.test" });
    const error = await expectRejection(
      (await callerFor(outsider)).form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "x" }],
      }),
    );
    expect(error.message).toBe("DOMAIN_NOT_ALLOWED");

    const insider = await makeUser({ email: "person@allowed.test" });
    await expect(
      (await callerFor(insider)).form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "x" }],
      }),
    ).resolves.toBeDefined();
  });

  it("accepts a subdomain of an allowed domain", async () => {
    const { form, fieldId } = await publishedForm({
      requireSignIn: true,
      allowedEmailDomains: ["allowed.test"],
    });
    const responder = await makeUser({ email: "person@mail.allowed.test" });

    await expect(
      (await callerFor(responder)).form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "x" }],
      }),
    ).resolves.toBeDefined();
  });

  it("records the respondent's email only when the form asks for it", async () => {
    const responder = await makeUser({ email: "person@example.test" });

    const quiet = await publishedForm({ requireSignIn: true, slug: "quiet" });
    const { id: quietId } = await (await callerFor(responder)).form.submitForm({
      formId: quiet.form.id,
      values: [{ formFieldId: quiet.fieldId, value: "x" }],
    });

    const collecting = await publishedForm({ collectRespondentEmail: true, slug: "collecting" });
    const { id: collectingId } = await (await callerFor(responder)).form.submitForm({
      formId: collecting.form.id,
      values: [{ formFieldId: collecting.fieldId, value: "x" }],
    });

    const [quietRow] = await db
      .select()
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.id, quietId));
    const [collectingRow] = await db
      .select()
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.id, collectingId));

    expect(quietRow?.respondentEmail).toBeNull();
    expect(collectingRow?.respondentEmail).toBe("person@example.test");
  });
});

/* ─── One response per respondent ──────────────────────────────────────── */

describe("one response per respondent", () => {
  it("refuses the same account a second time", async () => {
    const { form, fieldId } = await publishedForm({
      requireSignIn: true,
      oneResponsePerRespondent: true,
    });
    const responder = await makeUser();
    const caller = await callerFor(responder);

    await caller.form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fieldId, value: "first" }],
    });

    const error = await expectRejection(
      caller.form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "second" }],
      }),
    );
    expect(error.message).toBe("ALREADY_RESPONDED");
  });

  it("still lets a different account respond", async () => {
    const { form, fieldId } = await publishedForm({
      requireSignIn: true,
      oneResponsePerRespondent: true,
    });

    const first = await makeUser();
    const second = await makeUser();

    await (await callerFor(first)).form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fieldId, value: "a" }],
    });
    await expect(
      (await callerFor(second)).form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "b" }],
      }),
    ).resolves.toBeDefined();
  });

  it("turns an anonymous responder away, even carrying a visitor id", async () => {
    /* `requiresSignIn` is true whenever oneResponsePerRespondent is set, so the
     * anonymous responder never reaches the visitor-id check below — the limit
     * is enforced by demanding an account, not by trusting a client-supplied
     * identifier. See the note at the end of this block. */
    const { form, fieldId } = await publishedForm({ oneResponsePerRespondent: true });

    const error = await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "a" }],
        visitorId: "visitor-1",
      }),
    );
    expect(error.message).toBe("SIGN_IN_REQUIRED");
    expect(await db.select().from(formSubmissionsTable)).toHaveLength(0);
  });

  it("does not carry a limit across forms", async () => {
    const first = await publishedForm({ oneResponsePerRespondent: true, slug: "first" });
    const second = await publishedForm({ oneResponsePerRespondent: true, slug: "second" });
    const responder = await makeUser();

    await (await callerFor(responder)).form.submitForm({
      formId: first.form.id,
      values: [{ formFieldId: first.fieldId, value: "a" }],
    });

    await expect(
      (await callerFor(responder)).form.submitForm({
        formId: second.form.id,
        values: [{ formFieldId: second.fieldId, value: "a" }],
      }),
    ).resolves.toBeDefined();
  });

  it("keeps exactly one row after a refused repeat", async () => {
    const { form, fieldId } = await publishedForm({ oneResponsePerRespondent: true });
    const responder = await makeUser();
    const caller = await callerFor(responder);

    await caller.form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fieldId, value: "a" }],
    });
    await expectRejection(
      caller.form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "b" }],
      }),
    );

    expect(await db.select().from(formSubmissionsTable)).toHaveLength(1);
  });

  it("never reaches its visitor-id branch, which is therefore dead code", async () => {
    /* submitForm computes:
     *     needsVisitorCheck = oneResponsePerRespondent && !requireSignIn && !!visitorId
     * but `assertRespondentAllowed` has already rejected any anonymous caller
     * by then, because requiresSignIn() is true as soon as
     * oneResponsePerRespondent is set. So that branch — and the
     * ALREADY_SUBMITTED error it raises — cannot run today.
     *
     * Pinned rather than deleted: if the implication is ever relaxed so that
     * anonymous one-response forms are possible, this test starts failing and
     * points at the code that needs revisiting. */
    const { form, fieldId } = await publishedForm({
      oneResponsePerRespondent: true,
      requireSignIn: false,
    });

    const error = await expectRejection(
      anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: "a" }],
        visitorId: "visitor-1",
      }),
    );
    expect(error.message, "ALREADY_SUBMITTED is unreachable").toBe("SIGN_IN_REQUIRED");
  });
});

/* ─── Idempotency ──────────────────────────────────────────────────────── */

describe("an idempotency key", () => {
  it("returns the original submission instead of creating a second", async () => {
    const { form, fieldId } = await publishedForm();

    const first = await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fieldId, value: "x" }],
      idempotencyKey: "key-1",
    });
    const retry = await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fieldId, value: "x" }],
      idempotencyKey: "key-1",
    });

    expect(retry.id, "a double-tapped submit button is not two responses").toBe(first.id);
    expect(await db.select().from(formSubmissionsTable)).toHaveLength(1);
  });

  it("treats different keys as different submissions", async () => {
    const { form, fieldId } = await publishedForm();

    await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fieldId, value: "x" }],
      idempotencyKey: "key-1",
    });
    await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fieldId, value: "y" }],
      idempotencyKey: "key-2",
    });

    expect(await db.select().from(formSubmissionsTable)).toHaveLength(2);
  });

  it("scopes the key to one form, since the index is on both columns", async () => {
    const first = await publishedForm({ slug: "first" });
    const second = await publishedForm({ slug: "second" });

    await anonymousCaller().form.submitForm({
      formId: first.form.id,
      values: [{ formFieldId: first.fieldId, value: "x" }],
      idempotencyKey: "shared-key",
    });
    await expect(
      anonymousCaller().form.submitForm({
        formId: second.form.id,
        values: [{ formFieldId: second.fieldId, value: "x" }],
        idempotencyKey: "shared-key",
      }),
    ).resolves.toBeDefined();

    expect(await db.select().from(formSubmissionsTable)).toHaveLength(2);
  });

  it("does not deduplicate submissions that carry no key", async () => {
    /* The unique index is partial — NULL keys are exempt — so two identical
     * anonymous responses are two responses, which is correct. */
    const { form, fieldId } = await publishedForm();

    await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fieldId, value: "x" }],
    });
    await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fieldId, value: "x" }],
    });

    expect(await db.select().from(formSubmissionsTable)).toHaveLength(2);
  });
});

/* ─── Stored values ────────────────────────────────────────────────────── */

describe("the stored answers", () => {
  it("round-trip with their types intact", async () => {
    const form = await makeForm(owner, { isPublished: true });
    const text = await makeField(form, { label: "Name", type: "TEXT" });
    const number = await makeField(form, { label: "Age", type: "NUMBER" });
    const boxes = await makeField(form, { label: "Colours", type: "CHECKBOX" });
    const toggle = await makeField(form, { label: "Agree", type: "TOGGLE" });

    const { id } = await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [
        { formFieldId: text.id, value: "Ada" },
        { formFieldId: number.id, value: 36 },
        { formFieldId: boxes.id, value: ["red", "blue"] },
        { formFieldId: toggle.id, value: true },
      ],
    });

    const [row] = await db
      .select()
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.id, id));

    const byField = Object.fromEntries(
      (row?.values as Array<{ formFieldId: string; value: unknown }>).map((entry) => [
        entry.formFieldId,
        entry.value,
      ]),
    );

    expect(byField[text.id]).toBe("Ada");
    expect(byField[number.id]).toBe(36);
    expect(byField[boxes.id]).toEqual(["red", "blue"]);
    expect(byField[toggle.id]).toBe(true);
  });

  it("keep the attribution a client supplied", async () => {
    const { form, fieldId } = await publishedForm();

    const { id } = await anonymousCaller().form.submitForm({
      formId: form.id,
      values: [{ formFieldId: fieldId, value: "x" }],
      referrer: "https://example.test/blog",
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "launch",
      timeSpentMs: 42_000,
      deviceType: "mobile",
    });

    const [row] = await db
      .select()
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.id, id));

    expect(row?.utmSource).toBe("newsletter");
    expect(row?.deviceType).toBe("mobile");
    expect(row?.timeSpentMs).toBe(42_000);
  });
});

/* ─── Reading responses back ───────────────────────────────────────────── */

describe("form.getSubmissions", () => {
  async function formWithResponses(count: number) {
    const { form, fieldId } = await publishedForm();
    for (let i = 0; i < count; i++) {
      await anonymousCaller().form.submitForm({
        formId: form.id,
        values: [{ formFieldId: fieldId, value: `answer ${i}` }],
      });
      /* createdAt is the cursor, so the rows need distinguishable timestamps. */
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    return form;
  }

  it("returns the owner's responses newest first", async () => {
    const form = await formWithResponses(3);
    const caller = await callerFor(owner);

    const page = await caller.form.getSubmissions({ formId: form.id });

    expect(page.submissions).toHaveLength(3);
    const times = page.submissions.map((row) => new Date(row.createdAt as string).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("pages with a cursor that does not skip or repeat a row", async () => {
    const form = await formWithResponses(5);
    const caller = await callerFor(owner);

    const first = await caller.form.getSubmissions({
      formId: form.id,
      limit: 2,
    });
    expect(first.submissions).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await caller.form.getSubmissions({
      formId: form.id,
      limit: 2,
      cursor: first.nextCursor,
    });
    const third = await caller.form.getSubmissions({
      formId: form.id,
      limit: 2,
      cursor: second.nextCursor,
    });

    const ids = [...first.submissions, ...second.submissions, ...third.submissions].map(
      (row) => row.id,
    );
    expect(new Set(ids).size, "no row appears on two pages").toBe(5);
    expect(third.nextCursor).toBeNull();
  });

  it("lets a viewer read responses", async () => {
    const form = await formWithResponses(1);
    const viewer = await makeUser();
    await (await callerFor(owner)).form.addCollaborator({
      formId: form.id,
      email: viewer.email,
      role: "viewer",
    });

    const page = await (await callerFor(viewer)).form.getSubmissions({
      formId: form.id,
    });
    expect(page.submissions).toHaveLength(1);
  });

  it("refuses a stranger, whatever ownerId they claim", async () => {
    const form = await formWithResponses(1);
    const stranger = await makeUser();

    const error = await expectRejection(
      (await callerFor(stranger)).form.getSubmissions({ formId: form.id }),
    );
    expect(error.message).toMatch(/viewer access required/i);
  });

  it("never returns another form's responses", async () => {
    const mine = await formWithResponses(2);
    const theirs = await publishedForm({ slug: "theirs" });
    await anonymousCaller().form.submitForm({
      formId: theirs.form.id,
      values: [{ formFieldId: theirs.fieldId, value: "not mine" }],
    });

    const page = await (await callerFor(owner)).form.getSubmissions({
      formId: mine.id,
    });
    expect(page.submissions).toHaveLength(2);
    expect(page.submissions.every((row) => row.formId === mine.id)).toBe(true);
  });
});

/* ─── Drafts ───────────────────────────────────────────────────────────── */

describe("drafts", () => {
  it("save, resume and discard for one respondent", async () => {
    const { form, fieldId } = await publishedForm();
    const responder = await makeUser();
    const caller = await callerFor(responder);

    await caller.form.saveDraft({
      formId: form.id,
      values: { [fieldId]: "half an answer" },
      pagePath: [0, 1],
    });

    const resumed = await caller.form.getDraft({ formId: form.id });
    expect(resumed?.values).toEqual({ [fieldId]: "half an answer" });
    expect(resumed?.pagePath).toEqual([0, 1]);

    await caller.form.deleteDraft({ formId: form.id });
    expect(await caller.form.getDraft({ formId: form.id })).toBeNull();
  });

  it("overwrite rather than accumulate", async () => {
    const { form, fieldId } = await publishedForm();
    const caller = await callerFor(await makeUser());

    await caller.form.saveDraft({ formId: form.id, values: { [fieldId]: "first" } });
    await caller.form.saveDraft({ formId: form.id, values: { [fieldId]: "second" } });

    const draft = await caller.form.getDraft({ formId: form.id });
    expect(draft?.values).toEqual({ [fieldId]: "second" });
  });

  it("are private to the person who saved them", async () => {
    const { form, fieldId } = await publishedForm();
    const mine = await callerFor(await makeUser());
    const theirs = await callerFor(await makeUser());

    await mine.form.saveDraft({ formId: form.id, values: { [fieldId]: "mine" } });

    expect(await theirs.form.getDraft({ formId: form.id })).toBeNull();
  });

  it("return nothing when there is no draft", async () => {
    const { form } = await publishedForm();
    const caller = await callerFor(await makeUser());
    expect(await caller.form.getDraft({ formId: form.id })).toBeNull();
  });
});
